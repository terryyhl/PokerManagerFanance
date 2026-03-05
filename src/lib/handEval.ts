/**
 * 前端牌型评估 + 自动摆牌
 *
 * 用于:
 *  1. 实时显示每道牌型名称 (evaluateLaneName / evaluateAllLanes)
 *  2. 前端自动摆牌 (autoArrange) — 替代后端 API，避免 Vercel 超时
 *
 * 鬼牌策略: 自动摆牌时鬼牌按最大值(A♠)参与排序和比较，
 *           不做暴力枚举替换（那是后端结算的事）。
 */

// ─── 常量 ────────────────────────────────────────────────────────

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const SUIT_VALUE: Record<string, number> = {
  'S': 4, 'H': 3, 'C': 2, 'D': 1,
};

enum HandRank {
  HIGH_CARD = 1,
  PAIR = 2,
  TWO_PAIR = 3,
  THREE_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_KIND = 8,
  STRAIGHT_FLUSH = 9,
  FIVE_KIND = 10,
}

const HAND_RANK_NAME: Record<number, string> = {
  [HandRank.HIGH_CARD]: '高牌',
  [HandRank.PAIR]: '一对',
  [HandRank.TWO_PAIR]: '二对',
  [HandRank.THREE_KIND]: '三条',
  [HandRank.STRAIGHT]: '顺子',
  [HandRank.FLUSH]: '同花',
  [HandRank.FULL_HOUSE]: '葫芦',
  [HandRank.FOUR_KIND]: '四条',
  [HandRank.STRAIGHT_FLUSH]: '同花顺',
  [HandRank.FIVE_KIND]: '五条',
};

// ─── 得分表 (与后端 hands.ts 一致) ──────────────────────────────

const HEAD_SCORE: Partial<Record<HandRank, number>> = {
  [HandRank.HIGH_CARD]: 1, [HandRank.PAIR]: 1, [HandRank.THREE_KIND]: 3,
};
const MID_SCORE: Partial<Record<HandRank, number>> = {
  [HandRank.HIGH_CARD]: 1, [HandRank.PAIR]: 1, [HandRank.TWO_PAIR]: 1,
  [HandRank.THREE_KIND]: 1, [HandRank.STRAIGHT]: 1, [HandRank.FLUSH]: 1,
  [HandRank.FULL_HOUSE]: 2, [HandRank.FOUR_KIND]: 8, [HandRank.STRAIGHT_FLUSH]: 10,
  [HandRank.FIVE_KIND]: 20,
};
const TAIL_SCORE: Partial<Record<HandRank, number>> = {
  [HandRank.HIGH_CARD]: 1, [HandRank.PAIR]: 1, [HandRank.TWO_PAIR]: 1,
  [HandRank.THREE_KIND]: 1, [HandRank.STRAIGHT]: 1, [HandRank.FLUSH]: 1,
  [HandRank.FULL_HOUSE]: 1, [HandRank.FOUR_KIND]: 4, [HandRank.STRAIGHT_FLUSH]: 5,
  [HandRank.FIVE_KIND]: 10,
};

function getLaneScore(lane: 'head' | 'mid' | 'tail', rank: HandRank): number {
  const table = lane === 'head' ? HEAD_SCORE : lane === 'mid' ? MID_SCORE : TAIL_SCORE;
  return table[rank] ?? 1;
}

// ─── 工具 ────────────────────────────────────────────────────────

function isGhost(card: string): boolean {
  return card.startsWith('JK');
}

function parseCard(card: string): { rank: string; suit: string } | null {
  if (isGhost(card)) return null;
  return { rank: card.slice(0, -1), suit: card.slice(-1) };
}

function getCardValue(card: string): number {
  if (isGhost(card)) return 14; // 鬼牌当 A
  const p = parseCard(card);
  return p ? RANK_VALUE[p.rank] : 0;
}

function getCardSuitValue(card: string): number {
  if (isGhost(card)) return 4; // 鬼牌当 ♠
  const p = parseCard(card);
  return p ? SUIT_VALUE[p.suit] : 0;
}

function countByStr(items: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) map[item] = (map[item] || 0) + 1;
  return map;
}

// ─── HandResult (用于自动摆牌的比较) ────────────────────────────

interface EvalResult {
  rank: HandRank;
  sortKey: number[];
  score: number;
  name: string;
}

// ─── 5张牌评估 (带 sortKey) ─────────────────────────────────────

function eval5Full(cards: string[]): EvalResult {
  // 鬼牌当 A♠ 参与评估（简化版）
  const resolved = cards.map(c => isGhost(c) ? 'AS' : c);
  const parsed = resolved.map(c => parseCard(c)!);
  const values = parsed.map(p => RANK_VALUE[p.rank]);
  const suits = parsed.map(p => p.suit);
  const suitValues = parsed.map(p => SUIT_VALUE[p.suit]);

  const isFlush = new Set(suits).size === 1;
  const sorted = [...values].sort((a, b) => b - a);

  let isStraight = false;
  let straightHigh = 0;
  const unique = [...new Set(sorted)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) { isStraight = true; straightHigh = unique[0]; }
    if (!isStraight && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      isStraight = true; straightHigh = 5;
    }
  }

  const rankCounts = countByStr(parsed.map(p => p.rank));
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const grouped = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank, count, value: RANK_VALUE[rank] }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const sortKeyFromGroups = grouped.map(g => g.value);
  const maxSuitVal = Math.max(...suitValues);

  // 五条 (需要鬼牌)
  if (cards.some(isGhost) && new Set(values).size === 1) {
    return { rank: HandRank.FIVE_KIND, sortKey: [values[0]], score: 0, name: '五条' };
  }
  if (isFlush && isStraight) return { rank: HandRank.STRAIGHT_FLUSH, sortKey: [straightHigh, maxSuitVal], score: 0, name: '同花顺' };
  if (counts[0] === 4) return { rank: HandRank.FOUR_KIND, sortKey: sortKeyFromGroups, score: 0, name: '四条' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: HandRank.FULL_HOUSE, sortKey: sortKeyFromGroups, score: 0, name: '葫芦' };
  if (isFlush) return { rank: HandRank.FLUSH, sortKey: [...sorted, maxSuitVal], score: 0, name: '同花' };
  if (isStraight) return { rank: HandRank.STRAIGHT, sortKey: [straightHigh, maxSuitVal], score: 0, name: '顺子' };
  if (counts[0] === 3) return { rank: HandRank.THREE_KIND, sortKey: sortKeyFromGroups, score: 0, name: '三条' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: HandRank.TWO_PAIR, sortKey: sortKeyFromGroups, score: 0, name: '二对' };
  if (counts[0] === 2) return { rank: HandRank.PAIR, sortKey: sortKeyFromGroups, score: 0, name: '一对' };
  return { rank: HandRank.HIGH_CARD, sortKey: [...sorted, maxSuitVal], score: 0, name: '高牌' };
}

// ─── 3张牌评估 (带 sortKey) ─────────────────────────────────────

function eval3Full(cards: string[]): EvalResult {
  const resolved = cards.map(c => isGhost(c) ? 'AS' : c);
  const parsed = resolved.map(c => parseCard(c)!);
  const values = parsed.map(p => RANK_VALUE[p.rank]);
  const suitValues = parsed.map(p => SUIT_VALUE[p.suit]);
  const sorted = [...values].sort((a, b) => b - a);
  const maxSuitVal = Math.max(...suitValues);

  const rankCounts = countByStr(parsed.map(p => p.rank));
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const grouped = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank, count, value: RANK_VALUE[rank] }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const sortKeyFromGroups = grouped.map(g => g.value);

  if (counts[0] === 3) return { rank: HandRank.THREE_KIND, sortKey: sortKeyFromGroups, score: 0, name: '三条' };
  if (counts[0] === 2) return { rank: HandRank.PAIR, sortKey: sortKeyFromGroups, score: 0, name: '一对' };
  return { rank: HandRank.HIGH_CARD, sortKey: [...sorted, maxSuitVal], score: 0, name: '高牌' };
}

// ─── 比较 ────────────────────────────────────────────────────────

function compareResults(a: EvalResult, b: EvalResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.sortKey.length, b.sortKey.length); i++) {
    const va = a.sortKey[i] ?? 0;
    const vb = b.sortKey[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// ─── 组合生成器 ─────────────────────────────────────────────────

function combinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo = new Array<number>(k);
  function dfs(start: number, depth: number) {
    if (depth === k) { result.push([...combo]); return; }
    for (let i = start; i <= n - (k - depth); i++) {
      combo[depth] = i;
      dfs(i + 1, depth + 1);
    }
  }
  dfs(0, 0);
  return result;
}

// ─── 自动摆牌 ───────────────────────────────────────────────────

export interface AutoArrangeResult {
  head: string[];
  mid: string[];
  tail: string[];
  headName: string;
  midName: string;
  tailName: string;
  totalScore: number;
  valid: boolean;
}

/**
 * 前端自动摆牌：给定13张牌，返回最优的 3+5+5 分配方案
 * 策略与后端一致: 尾道最强优先 → 总分最高 → 中道最强
 */
export function autoArrange(cards: string[]): AutoArrangeResult {
  if (cards.length !== 13) throw new Error(`需要13张牌，当前${cards.length}张`);

  const indices = Array.from({ length: 13 }, (_, i) => i);
  const headCombos = combinations(13, 3); // C(13,3) = 286

  let best: {
    head: string[]; mid: string[]; tail: string[];
    headResult: EvalResult; midResult: EvalResult; tailResult: EvalResult;
    totalScore: number; valid: boolean;
  } | null = null;

  for (const headIdx of headCombos) {
    const headCards = headIdx.map(i => cards[i]);
    const remainIdx = indices.filter(i => !headIdx.includes(i));
    const midCombos = combinations(10, 5); // C(10,5) = 252

    for (const midLocalIdx of midCombos) {
      const midIdx = midLocalIdx.map(j => remainIdx[j]);
      const midCards = midIdx.map(i => cards[i]);
      const tailCards = remainIdx.filter(i => !midIdx.includes(i)).map(i => cards[i]);

      const headResult = eval3Full(headCards);
      const midResult = eval5Full(midCards);
      const tailResult = eval5Full(tailCards);

      headResult.score = getLaneScore('head', headResult.rank);
      midResult.score = getLaneScore('mid', midResult.rank);
      tailResult.score = getLaneScore('tail', tailResult.rank);

      const valid = compareResults(tailResult, midResult) >= 0 && compareResults(midResult, headResult) >= 0;
      const totalScore = headResult.score + midResult.score + tailResult.score;

      const current = { head: headCards, mid: midCards, tail: tailCards, headResult, midResult, tailResult, totalScore, valid };

      if (!best) { best = current; continue; }

      // 优先选合法方案
      if (current.valid && !best.valid) { best = current; continue; }
      if (!current.valid && best.valid) continue;

      // 尾道最强优先
      const tailCmp = compareResults(current.tailResult, best.tailResult);
      if (tailCmp > 0) { best = current; continue; }
      if (tailCmp < 0) continue;

      // 总分更高
      if (current.totalScore > best.totalScore) { best = current; continue; }
      if (current.totalScore < best.totalScore) continue;

      // 中道更强
      if (compareResults(current.midResult, best.midResult) > 0) best = current;
    }
  }

  const b = best!;
  return {
    head: b.head, mid: b.mid, tail: b.tail,
    headName: b.headResult.name, midName: b.midResult.name, tailName: b.tailResult.name,
    totalScore: b.totalScore, valid: b.valid,
  };
}

// ─── 原有公开接口（牌型名称显示） ──────────────────────────────

function evaluate5Simple(cards: string[]): { rank: HandRank; name: string } {
  const parsed = cards.map(c => parseCard(c)!);
  const values = parsed.map(p => RANK_VALUE[p.rank]);
  const suits = parsed.map(p => p.suit);

  const isFlush = new Set(suits).size === 1;
  const sorted = [...values].sort((a, b) => b - a);

  let isStraight = false;
  const unique = [...new Set(sorted)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) isStraight = true;
    if (!isStraight && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      isStraight = true;
    }
  }

  const rankCounts = countByStr(parsed.map(p => p.rank));
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (isFlush && isStraight) return { rank: HandRank.STRAIGHT_FLUSH, name: '同花顺' };
  if (counts[0] === 4) return { rank: HandRank.FOUR_KIND, name: '四条' };
  if (counts[0] === 3 && counts[1] === 2) return { rank: HandRank.FULL_HOUSE, name: '葫芦' };
  if (isFlush) return { rank: HandRank.FLUSH, name: '同花' };
  if (isStraight) return { rank: HandRank.STRAIGHT, name: '顺子' };
  if (counts[0] === 3) return { rank: HandRank.THREE_KIND, name: '三条' };
  if (counts[0] === 2 && counts[1] === 2) return { rank: HandRank.TWO_PAIR, name: '二对' };
  if (counts[0] === 2) return { rank: HandRank.PAIR, name: '一对' };
  return { rank: HandRank.HIGH_CARD, name: '高牌' };
}

function evaluate3Simple(cards: string[]): { rank: HandRank; name: string } {
  const parsed = cards.map(c => parseCard(c)!);
  const rankCounts = countByStr(parsed.map(p => p.rank));
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (counts[0] === 3) return { rank: HandRank.THREE_KIND, name: '三条' };
  if (counts[0] === 2) return { rank: HandRank.PAIR, name: '一对' };
  return { rank: HandRank.HIGH_CARD, name: '高牌' };
}

/**
 * 评估一道的牌型名称
 */
export function evaluateLaneName(cards: string[], lane: 'head' | 'mid' | 'tail'): string | null {
  if (!cards || cards.length === 0) return null;
  const expectedCount = lane === 'head' ? 3 : 5;
  if (cards.length !== expectedCount) return null;
  if (cards.some(isGhost)) return '含鬼';
  if (lane === 'head') return evaluate3Simple(cards).name;
  return evaluate5Simple(cards).name;
}

/**
 * 批量评估三道牌型
 */
export function evaluateAllLanes(
  headCards: string[],
  midCards: string[],
  tailCards: string[],
): { head: string | null; mid: string | null; tail: string | null } {
  return {
    head: evaluateLaneName(headCards, 'head'),
    mid: evaluateLaneName(midCards, 'mid'),
    tail: evaluateLaneName(tailCards, 'tail'),
  };
}
