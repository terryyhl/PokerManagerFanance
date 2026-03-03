/**
 * 前端简化版牌型评估
 *
 * 不处理鬼牌替换（鬼牌在前端仅显示原始牌面），
 * 只对非鬼牌的标准牌进行牌型判定。
 * 含鬼牌的道次显示 "含鬼" 标记。
 */

// ─── 常量 ────────────────────────────────────────────────────────

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
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

// ─── 工具 ────────────────────────────────────────────────────────

function isGhost(card: string): boolean {
  return card.startsWith('JK');
}

function parseCard(card: string): { rank: string; suit: string } | null {
  if (isGhost(card)) return null;
  return { rank: card.slice(0, -1), suit: card.slice(-1) };
}

function countBy(items: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    map[item] = (map[item] || 0) + 1;
  }
  return map;
}

// ─── 5张牌评估 ──────────────────────────────────────────────────

function evaluate5(cards: string[]): { rank: HandRank; name: string } {
  const parsed = cards.map(c => parseCard(c)!);
  const values = parsed.map(p => RANK_VALUE[p.rank]);
  const suits = parsed.map(p => p.suit);

  const isFlush = new Set(suits).size === 1;
  const sorted = [...values].sort((a, b) => b - a);

  // 检查顺子
  let isStraight = false;
  const unique = [...new Set(sorted)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
    }
    // A2345
    if (!isStraight && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      isStraight = true;
    }
  }

  const rankCounts = countBy(parsed.map(p => p.rank));
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

// ─── 3张牌评估 ──────────────────────────────────────────────────

function evaluate3(cards: string[]): { rank: HandRank; name: string } {
  const parsed = cards.map(c => parseCard(c)!);
  const rankCounts = countBy(parsed.map(p => p.rank));
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (counts[0] === 3) return { rank: HandRank.THREE_KIND, name: '三条' };
  if (counts[0] === 2) return { rank: HandRank.PAIR, name: '一对' };
  return { rank: HandRank.HIGH_CARD, name: '高牌' };
}

// ─── 公开接口 ──────────────────────────────────────────────────

/**
 * 评估一道的牌型名称
 * @param cards 该道的牌面数组
 * @param lane 'head' | 'mid' | 'tail'
 * @returns 牌型名称（如 "同花顺"），含鬼牌时返回 null（无法在前端准确判定）
 */
export function evaluateLaneName(cards: string[], lane: 'head' | 'mid' | 'tail'): string | null {
  if (!cards || cards.length === 0) return null;

  const expectedCount = lane === 'head' ? 3 : 5;
  if (cards.length !== expectedCount) return null;

  // 含鬼牌时无法在前端准确判定（需要暴力枚举替换）
  if (cards.some(isGhost)) return '含鬼';

  if (lane === 'head') {
    return evaluate3(cards).name;
  }
  return evaluate5(cards).name;
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
