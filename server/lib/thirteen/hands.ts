/**
 * 13水牌型判定引擎
 *
 * 牌型等级 (HandRank):
 *   头道(3张): HIGH_CARD=1, PAIR=2, THREE_KIND=3
 *   中尾道(5张): HIGH_CARD=1, PAIR=2, TWO_PAIR=3, THREE_KIND=4,
 *                STRAIGHT=5, FLUSH=6, FULL_HOUSE=7, FOUR_KIND=8,
 *                STRAIGHT_FLUSH=9, FIVE_KIND=10
 *
 * 鬼牌处理: 枚举所有可能替换，选出最优牌型
 */

import { Card, isGhost, parseCard, RANK_VALUE, SUIT_VALUE, SUITS, RANKS, Rank, Suit } from './deck.js';

// ─── 牌型枚举 ────────────────────────────────────────────────────

export enum HandRank {
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

export const HAND_RANK_NAME: Record<HandRank, string> = {
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

export interface HandResult {
    rank: HandRank;
    /** 用于同牌型比较的排序键（从高到低） */
    sortKey: number[];
    /** 基础得分 */
    score: number;
    /** 描述 */
    name: string;
    /** 解析后的牌（鬼牌替换后） */
    resolvedCards: Card[];
}

// ─── 基础得分表 ──────────────────────────────────────────────────

/** 头道得分 */
const HEAD_SCORE: Partial<Record<HandRank, number>> = {
    [HandRank.HIGH_CARD]: 1,
    [HandRank.PAIR]: 1,
    [HandRank.THREE_KIND]: 3,
};

/** 中道得分 */
const MID_SCORE: Partial<Record<HandRank, number>> = {
    [HandRank.HIGH_CARD]: 1,
    [HandRank.PAIR]: 1,
    [HandRank.TWO_PAIR]: 1,
    [HandRank.THREE_KIND]: 1,
    [HandRank.STRAIGHT]: 1,
    [HandRank.FLUSH]: 1,
    [HandRank.FULL_HOUSE]: 2,
    [HandRank.FOUR_KIND]: 8,
    [HandRank.STRAIGHT_FLUSH]: 10,
    [HandRank.FIVE_KIND]: 20,
};

/** 尾道得分 */
const TAIL_SCORE: Partial<Record<HandRank, number>> = {
    [HandRank.HIGH_CARD]: 1,
    [HandRank.PAIR]: 1,
    [HandRank.TWO_PAIR]: 1,
    [HandRank.THREE_KIND]: 1,
    [HandRank.STRAIGHT]: 1,
    [HandRank.FLUSH]: 1,
    [HandRank.FULL_HOUSE]: 1,
    [HandRank.FOUR_KIND]: 4,
    [HandRank.STRAIGHT_FLUSH]: 5,
    [HandRank.FIVE_KIND]: 10,
};

export type Lane = 'head' | 'mid' | 'tail';

export function getLaneScore(lane: Lane, rank: HandRank): number {
    const table = lane === 'head' ? HEAD_SCORE : lane === 'mid' ? MID_SCORE : TAIL_SCORE;
    return table[rank] ?? 1;
}

// ─── 头道特殊得分（三鬼/双鬼） ──────────────────────────────────

export function getHeadSpecialScore(cards: Card[]): number {
    const ghosts = cards.filter(c => isGhost(c)).length;
    if (ghosts === 3) return 20; // 头道三鬼
    if (ghosts === 2) return 15; // 头道双鬼
    return 0; // 非特殊，走普通得分
}

// ─── 工具函数 ────────────────────────────────────────────────────

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
    const map: Record<string, number> = {};
    for (const item of arr) {
        const key = fn(item);
        map[key] = (map[key] || 0) + 1;
    }
    return map;
}

/** 将点数数组排序（降序），用于 sortKey */
function sortedValuesDesc(values: number[]): number[] {
    return [...values].sort((a, b) => b - a);
}

// ─── 5张牌牌型判定（无鬼牌） ────────────────────────────────────

function evaluate5(cards: Card[]): HandResult {
    const parsed = cards.map(c => parseCard(c)!);
    const values = parsed.map(p => RANK_VALUE[p.rank]);
    const suits = parsed.map(p => p.suit);
    const suitValues = parsed.map(p => SUIT_VALUE[p.suit]);

    const isFlush = new Set(suits).size === 1;
    const sorted = sortedValuesDesc(values);

    // 检查顺子 — 特殊处理 A2345 和 TJQKA
    let isStraight = false;
    let straightHigh = 0;
    const unique = [...new Set(sorted)].sort((a, b) => b - a);
    if (unique.length === 5) {
        if (unique[0] - unique[4] === 4) {
            isStraight = true;
            straightHigh = unique[0];
        }
        // A2345 (14,5,4,3,2) — A 当 1
        if (!isStraight && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
            isStraight = true;
            straightHigh = 5; // A2345 的高牌是 5
        }
    }

    const rankCounts = countBy(parsed, p => p.rank);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // 生成 sortKey: 按牌型的关键组排序
    // 例如 葫芦: [三条点数, 对子点数]
    const groupedByCount: { rank: string; count: number; value: number }[] = Object.entries(rankCounts)
        .map(([rank, count]) => ({ rank, count, value: RANK_VALUE[rank] }))
        .sort((a, b) => b.count - a.count || b.value - a.value);

    const sortKeyFromGroups = groupedByCount.map(g => g.value);
    // 额外附加最高花色值用于花色比较
    const maxSuitVal = Math.max(...suitValues);

    // 同花顺
    if (isFlush && isStraight) {
        return {
            rank: HandRank.STRAIGHT_FLUSH,
            sortKey: [straightHigh, maxSuitVal],
            score: 0,
            name: `同花顺`,
            resolvedCards: cards,
        };
    }

    // 四条
    if (counts[0] === 4) {
        return {
            rank: HandRank.FOUR_KIND,
            sortKey: sortKeyFromGroups,
            score: 0,
            name: `四条`,
            resolvedCards: cards,
        };
    }

    // 葫芦
    if (counts[0] === 3 && counts[1] === 2) {
        return {
            rank: HandRank.FULL_HOUSE,
            sortKey: sortKeyFromGroups,
            score: 0,
            name: `葫芦`,
            resolvedCards: cards,
        };
    }

    // 同花
    if (isFlush) {
        return {
            rank: HandRank.FLUSH,
            sortKey: [...sorted, maxSuitVal],
            score: 0,
            name: `同花`,
            resolvedCards: cards,
        };
    }

    // 顺子
    if (isStraight) {
        return {
            rank: HandRank.STRAIGHT,
            sortKey: [straightHigh, maxSuitVal],
            score: 0,
            name: `顺子`,
            resolvedCards: cards,
        };
    }

    // 三条
    if (counts[0] === 3) {
        return {
            rank: HandRank.THREE_KIND,
            sortKey: sortKeyFromGroups,
            score: 0,
            name: `三条`,
            resolvedCards: cards,
        };
    }

    // 二对
    if (counts[0] === 2 && counts[1] === 2) {
        return {
            rank: HandRank.TWO_PAIR,
            sortKey: sortKeyFromGroups,
            score: 0,
            name: `二对`,
            resolvedCards: cards,
        };
    }

    // 一对
    if (counts[0] === 2) {
        return {
            rank: HandRank.PAIR,
            sortKey: sortKeyFromGroups,
            score: 0,
            name: `一对`,
            resolvedCards: cards,
        };
    }

    // 高牌
    return {
        rank: HandRank.HIGH_CARD,
        sortKey: [...sorted, maxSuitVal],
        score: 0,
        name: `高牌`,
        resolvedCards: cards,
    };
}

// ─── 3张牌牌型判定（无鬼牌） ────────────────────────────────────

function evaluate3(cards: Card[]): HandResult {
    const parsed = cards.map(c => parseCard(c)!);
    const values = parsed.map(p => RANK_VALUE[p.rank]);
    const suitValues = parsed.map(p => SUIT_VALUE[p.suit]);
    const sorted = sortedValuesDesc(values);
    const maxSuitVal = Math.max(...suitValues);

    const rankCounts = countBy(parsed, p => p.rank);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const groupedByCount = Object.entries(rankCounts)
        .map(([rank, count]) => ({ rank, count, value: RANK_VALUE[rank] }))
        .sort((a, b) => b.count - a.count || b.value - a.value);
    const sortKeyFromGroups = groupedByCount.map(g => g.value);

    if (counts[0] === 3) {
        return { rank: HandRank.THREE_KIND, sortKey: sortKeyFromGroups, score: 3, name: '三条', resolvedCards: cards };
    }
    if (counts[0] === 2) {
        return { rank: HandRank.PAIR, sortKey: [...sortKeyFromGroups, maxSuitVal], score: 1, name: '一对', resolvedCards: cards };
    }
    return { rank: HandRank.HIGH_CARD, sortKey: [...sorted, maxSuitVal], score: 1, name: '高牌', resolvedCards: cards };
}

// ─── 鬼牌替换：枚举所有可能 ────────────────────────────────────

/** 生成所有 52 张实牌 */
const ALL_REAL_CARDS: Card[] = [];
for (const rank of RANKS) {
    for (const suit of SUITS) {
        ALL_REAL_CARDS.push(`${rank}${suit}`);
    }
}

/**
 * 枚举鬼牌替换的所有组合（有剪枝）
 * 对于少量鬼牌(1~3张)，暴力枚举是可行的:
 *   1鬼: 52种  2鬼: 52*52=2704  3鬼: 52^3=140608
 * 但我们可以只枚举花色*点数的有效组合来大幅减少
 */
function enumerateGhostReplacements(cards: Card[], evaluator: (resolved: Card[]) => HandResult): HandResult {
    const ghostIndices: number[] = [];
    const realCards: Card[] = [];
    for (let i = 0; i < cards.length; i++) {
        if (isGhost(cards[i])) {
            ghostIndices.push(i);
        } else {
            realCards.push(cards[i]);
        }
    }

    if (ghostIndices.length === 0) {
        return evaluator(cards);
    }

    // 候选替换牌：所有52张实牌（允许重复，因为鬼牌可以变成任何牌）
    const candidates = ALL_REAL_CARDS;
    let best: HandResult | null = null;

    const tryReplace = (idx: number, current: Card[]) => {
        if (idx === ghostIndices.length) {
            const result = evaluator(current);
            if (!best || compareHandResults(result, best) > 0) {
                best = result;
            }
            return;
        }
        for (const candidate of candidates) {
            current[ghostIndices[idx]] = candidate;
            tryReplace(idx + 1, current);
        }
    };

    // 优化: 对于3张鬼牌(头道)，枚举量可接受 52^3=140k
    // 对于5张牌中最多6张鬼（不可能，最多3张鬼在手牌中）
    const working = [...cards];
    tryReplace(0, working);

    return best!;
}

// ─── 比较两个 HandResult ─────────────────────────────────────────

/** 返回 >0 表示 a 更大, <0 表示 b 更大, 0 表示相等 */
export function compareHandResults(a: HandResult, b: HandResult): number {
    if (a.rank !== b.rank) return a.rank - b.rank;
    // 同牌型比 sortKey
    for (let i = 0; i < Math.max(a.sortKey.length, b.sortKey.length); i++) {
        const va = a.sortKey[i] ?? 0;
        const vb = b.sortKey[i] ?? 0;
        if (va !== vb) return va - vb;
    }
    return 0;
}

// ─── 公开接口：评估一手牌 ────────────────────────────────────────

/**
 * 评估头道（3张牌）
 */
export function evaluateHead(cards: Card[]): HandResult {
    if (cards.length !== 3) throw new Error('头道必须3张牌');

    const ghostCount = cards.filter(c => isGhost(c)).length;
    if (ghostCount === 0) {
        const result = evaluate3(cards);
        result.score = getLaneScore('head', result.rank);
        return result;
    }

    // 有鬼牌：枚举替换
    const result = enumerateGhostReplacements(cards, evaluate3);
    // 特殊得分
    const special = getHeadSpecialScore(cards);
    result.score = special > 0 ? special : getLaneScore('head', result.rank);
    return result;
}

/**
 * 评估中道/尾道（5张牌）
 */
export function evaluateLane(cards: Card[], lane: 'mid' | 'tail'): HandResult {
    if (cards.length !== 5) throw new Error(`${lane === 'mid' ? '中' : '尾'}道必须5张牌`);

    const ghostCount = cards.filter(c => isGhost(c)).length;

    // 检查五条（需要鬼牌）
    if (ghostCount > 0) {
        const result = enumerateGhostReplacements(cards, (resolved) => {
            const ev = evaluate5(resolved);
            // 检查是否形成五条：5张同点数
            const parsed = resolved.map(c => parseCard(c)!);
            const values = parsed.map(p => RANK_VALUE[p.rank]);
            if (new Set(values).size === 1) {
                return {
                    rank: HandRank.FIVE_KIND,
                    sortKey: [values[0]],
                    score: 0,
                    name: '五条',
                    resolvedCards: resolved,
                };
            }
            return ev;
        });
        result.score = getLaneScore(lane, result.rank);
        return result;
    }

    const result = evaluate5(cards);
    result.score = getLaneScore(lane, result.rank);
    return result;
}

// ─── 乌龙检测 ────────────────────────────────────────────────────

/**
 * 检查三道是否满足 尾道 >= 中道 >= 头道
 * 返回 true 表示合法，false 表示乌龙
 */
export function validateArrangement(head: HandResult, mid: HandResult, tail: HandResult): boolean {
    return compareHandResults(tail, mid) >= 0 && compareHandResults(mid, head) >= 0;
}

// ─── 报到牌型检测 ────────────────────────────────────────────────

export type SpecialHand = 'dragon' | 'straight_dragon' | 'six_pairs' | 'three_flush' | 'three_straight' | null;

export interface SpecialHandResult {
    type: SpecialHand;
    score: number;
    name: string;
}

const SPECIAL_SCORES: Record<string, number> = {
    dragon: 52,
    straight_dragon: 26,
    six_pairs: 6,
    three_flush: 6,
    three_straight: 6,
};

/**
 * 检测13张牌是否构成报到牌型（不参与普通比牌）
 */
export function detectSpecialHand(allCards: Card[]): SpecialHandResult {
    if (allCards.length !== 13) return { type: null, score: 0, name: '' };

    const ghosts = allCards.filter(c => isGhost(c));
    const reals = allCards.filter(c => !isGhost(c));
    const ghostCount = ghosts.length;

    // 青龙：同花色 2~A (13张)，可带鬼
    if (checkDragon(reals, ghostCount)) {
        return { type: 'dragon', score: 52, name: '青龙' };
    }

    // 一条龙：2~A 不限花色，可带鬼
    if (checkStraightDragon(reals, ghostCount)) {
        return { type: 'straight_dragon', score: 26, name: '一条龙' };
    }

    // 以下不可带鬼
    if (ghostCount === 0) {
        // 六对半：6对 + 1单牌
        if (checkSixPairs(reals)) {
            return { type: 'six_pairs', score: 6, name: '六对半' };
        }
        // 三同花：头(3张同花) + 中(5张同花) + 尾(5张同花)
        // 这个需要在摆牌后才能检测，暂标记为 null
        // 三顺子同理
    }

    return { type: null, score: 0, name: '' };
}

function checkDragon(reals: Card[], ghostCount: number): boolean {
    // 需要恰好 13 张（real + ghost），同花色 2~A
    const parsed = reals.map(c => parseCard(c)!);
    if (reals.length + ghostCount !== 13) return false;

    // 检查实牌是否都同花色
    const suits = new Set(parsed.map(p => p.suit));
    if (suits.size > 1) return false;

    // 检查实牌点数是否都不同且在 2~A
    const values = new Set(parsed.map(p => RANK_VALUE[p.rank]));
    if (values.size !== reals.length) return false; // 有重复点数

    // 需要用 ghostCount 张鬼牌补齐 2~A (值 2~14)
    const allNeeded = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const v of values) allNeeded.delete(v);
    return allNeeded.size <= ghostCount;
}

function checkStraightDragon(reals: Card[], ghostCount: number): boolean {
    if (reals.length + ghostCount !== 13) return false;
    const parsed = reals.map(c => parseCard(c)!);
    const values = parsed.map(p => RANK_VALUE[p.rank]);
    // 每个点数只需出现一次
    const valueCounts = countBy(values.map(String), v => v);
    for (const count of Object.values(valueCounts)) {
        if (count > 1) return false; // 同点数多张，鬼不能补
    }
    const allNeeded = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const v of values) allNeeded.delete(v);
    return allNeeded.size <= ghostCount;
}

function checkSixPairs(reals: Card[]): boolean {
    if (reals.length !== 13) return false;
    const parsed = reals.map(c => parseCard(c)!);
    const rankCounts = countBy(parsed, p => p.rank);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    // 6对 + 1单 = 6个2 + 1个1
    let pairs = 0;
    let singles = 0;
    for (const c of counts) {
        if (c === 2) pairs++;
        else if (c === 1) singles++;
        else if (c === 4) pairs += 2; // 4张 = 2对
        else if (c === 3) { pairs++; singles++; } // 3张 = 1对 + 1单
        else return false;
    }
    return pairs === 6 && singles === 1;
}

/**
 * 检查摆好的三道是否构成三同花
 */
export function checkThreeFlush(head: Card[], mid: Card[], tail: Card[]): boolean {
    if (head.some(isGhost) || mid.some(isGhost) || tail.some(isGhost)) return false;
    const headSuits = new Set(head.map(c => parseCard(c)!.suit));
    const midSuits = new Set(mid.map(c => parseCard(c)!.suit));
    const tailSuits = new Set(tail.map(c => parseCard(c)!.suit));
    return headSuits.size === 1 && midSuits.size === 1 && tailSuits.size === 1;
}

/**
 * 检查摆好的三道是否构成三顺子
 */
export function checkThreeStraight(head: Card[], mid: Card[], tail: Card[]): boolean {
    if (head.some(isGhost) || mid.some(isGhost) || tail.some(isGhost)) return false;
    return isSequential(head) && isSequential(mid) && isSequential(tail);
}

function isSequential(cards: Card[]): boolean {
    const values = cards.map(c => RANK_VALUE[parseCard(c)!.rank]).sort((a, b) => a - b);
    const unique = [...new Set(values)];
    if (unique.length !== cards.length) return false;
    // 正常顺序
    if (unique[unique.length - 1] - unique[0] === unique.length - 1) return true;
    // A2345 特殊处理 (头道3张: A23)
    if (cards.length === 3 && unique.includes(14) && unique.includes(2) && unique.includes(3)) return true;
    // A2345 for 5张
    if (cards.length === 5 && unique[0] === 2 && unique[1] === 3 && unique[2] === 4 && unique[3] === 5 && unique[4] === 14) return true;
    return false;
}
