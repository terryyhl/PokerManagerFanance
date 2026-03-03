/**
 * 13水自动摆牌算法
 *
 * 给定13张牌，找出最优的 头道(3张) + 中道(5张) + 尾道(5张) 分配方案。
 * 约束: 尾道 >= 中道 >= 头道（否则乌龙）
 *
 * 算法: 暴力枚举 C(13,3)×C(10,5) = 72072 种组合，
 *       评估每种合法排列的总得分，选最高分方案。
 *       有多个同分方案时，优先选尾道最强的（防守策略）。
 */

import { Card } from './deck.js';
import {
    HandResult,
    evaluateHead,
    evaluateLane,
    validateArrangement,
    compareHandResults,
} from './hands.js';

export interface ArrangeResult {
    head: Card[];
    mid: Card[];
    tail: Card[];
    headResult: HandResult;
    midResult: HandResult;
    tailResult: HandResult;
    /** 总基础得分 (head.score + mid.score + tail.score) */
    totalScore: number;
    valid: boolean;
}

/** 组合生成器: 从 arr 中选 k 个元素的所有组合 */
function combinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];
    const combo: T[] = new Array(k);

    function dfs(start: number, depth: number) {
        if (depth === k) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i <= arr.length - (k - depth); i++) {
            combo[depth] = arr[i];
            dfs(i + 1, depth + 1);
        }
    }

    dfs(0, 0);
    return result;
}

/**
 * 自动摆牌：给定13张牌，返回最优方案
 *
 * @param cards 13张牌
 * @returns 最优摆牌方案，如果所有组合都是乌龙则返回得分最高的乌龙方案
 */
export function autoArrange(cards: Card[]): ArrangeResult {
    if (cards.length !== 13) {
        throw new Error(`需要13张牌，当前${cards.length}张`);
    }

    const indices = Array.from({ length: 13 }, (_, i) => i);
    let best: ArrangeResult | null = null;

    // 枚举头道: C(13,3) = 286
    const headCombos = combinations(indices, 3);

    for (const headIdx of headCombos) {
        const headCards = headIdx.map(i => cards[i]);
        const remainIdx = indices.filter(i => !headIdx.includes(i));

        // 枚举中道: C(10,5) = 252
        const midCombos = combinations(remainIdx, 5);

        for (const midIdx of midCombos) {
            const midCards = midIdx.map(i => cards[i]);
            const tailIdx = remainIdx.filter(i => !midIdx.includes(i));
            const tailCards = tailIdx.map(i => cards[i]);

            // 评估三道
            let headResult: HandResult;
            let midResult: HandResult;
            let tailResult: HandResult;
            try {
                headResult = evaluateHead(headCards);
                midResult = evaluateLane(midCards, 'mid');
                tailResult = evaluateLane(tailCards, 'tail');
            } catch {
                continue; // 评估失败跳过
            }

            // 检查合法性 (尾 >= 中 >= 头)
            const valid = validateArrangement(headResult, midResult, tailResult);
            const totalScore = headResult.score + midResult.score + tailResult.score;

            const current: ArrangeResult = {
                head: headCards,
                mid: midCards,
                tail: tailCards,
                headResult,
                midResult,
                tailResult,
                totalScore,
                valid,
            };

            if (!best) {
                best = current;
                continue;
            }

            // 优先选合法方案
            if (current.valid && !best.valid) {
                best = current;
                continue;
            }
            if (!current.valid && best.valid) {
                continue;
            }

            // 都合法或都乌龙时，比较综合实力
            // 1. 总得分更高
            if (current.totalScore > best.totalScore) {
                best = current;
                continue;
            }
            if (current.totalScore < best.totalScore) {
                continue;
            }

            // 2. 同分时，优先尾道更强（防守策略：尾道最重要）
            const tailCmp = compareHandResults(current.tailResult, best.tailResult);
            if (tailCmp > 0) {
                best = current;
                continue;
            }
            if (tailCmp < 0) {
                continue;
            }

            // 3. 尾道相同时，优先中道更强
            const midCmp = compareHandResults(current.midResult, best.midResult);
            if (midCmp > 0) {
                best = current;
            }
        }
    }

    return best!;
}
