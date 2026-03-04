/**
 * 13水结算引擎
 *
 * 结算流程:
 *   1. 检测报到牌型（特殊牌型直接得分，不参与普通比牌）
 *   2. 逐道两两比较（头/中/尾）
 *   3. 打枪检测（三道全赢 → 该对手得分翻倍）
 *   4. 全垒打检测（打枪所有对手 → 所有得分再翻倍）
 *   5. 鬼牌倍率（公共牌中鬼牌数 n → 所有分数 × 2^n）
 *   6. 底分倍率（最终分 × 底分）
 *
 * 零和结算: 所有玩家分数之和 = 0
 */

import { Card } from './deck.js';
import {
    HandResult,
    Lane,
    SpecialHand,
    evaluateHead,
    evaluateLane,
    validateArrangement,
    detectSpecialHand,
    checkThreeFlush,
    checkThreeStraight,
    compareHandResults,
    getHeadSpecialScore,
} from './hands.js';

// ─── 玩家手牌数据 ────────────────────────────────────────────────

export interface PlayerHand {
    userId: string;
    allCards: Card[];      // 全部13张原始牌
    headCards: Card[];     // 头道3张
    midCards: Card[];      // 中道5张
    tailCards: Card[];     // 尾道5张
    isFoul: boolean;       // 是否乌龙
}

// ─── 评估后的玩家数据 ────────────────────────────────────────────

export interface EvaluatedPlayer {
    userId: string;
    headResult: HandResult;
    midResult: HandResult;
    tailResult: HandResult;
    isFoul: boolean;
    specialHand: SpecialHand;
    specialScore: number;
    specialName: string;
}

// ─── 两两对比的单道得分记录 ──────────────────────────────────────

export interface LaneScoreRecord {
    lane: Lane | 'special' | 'gun' | 'homerun' | 'ghost';
    userId: string;
    opponentId: string;
    score: number;
    detail: string;
}

// ─── 玩家最终结算结果 ────────────────────────────────────────────

export interface PlayerSettlement {
    userId: string;
    rawScore: number;       // 原始分（三道 + 打枪 + 全垒打，不含鬼牌和底分）
    finalScore: number;     // 最终分（含鬼牌倍率和底分）
    gunsFired: number;      // 打枪次数
    homerun: boolean;       // 是否全垒打
    laneScores: LaneScoreRecord[];  // 明细
}

// ─── 整局结算结果 ────────────────────────────────────────────────

export interface RoundSettlement {
    players: PlayerSettlement[];
    ghostMultiplier: number;
    baseScore: number;
}

// ─── 评估所有玩家 ────────────────────────────────────────────────

export function evaluatePlayers(hands: PlayerHand[]): EvaluatedPlayer[] {
    return hands.map(h => {
        // 乌龙玩家不需要评估具体牌型
        if (h.isFoul) {
            const emptyResult: HandResult = {
                rank: 0 as any,
                sortKey: [],
                score: 0,
                name: '乌龙',
                resolvedCards: [],
            };
            return {
                userId: h.userId,
                headResult: emptyResult,
                midResult: emptyResult,
                tailResult: emptyResult,
                isFoul: true,
                specialHand: null,
                specialScore: 0,
                specialName: '',
            };
        }

        // 检测报到牌型
        const special = detectSpecialHand(h.allCards);

        // 如果没有报到牌型，还需检查摆牌后的三同花/三顺子
        let finalSpecial = special;
        if (!special.type) {
            if (checkThreeFlush(h.headCards, h.midCards, h.tailCards)) {
                finalSpecial = { type: 'three_flush' as SpecialHand, score: 6, name: '三同花' };
            } else if (checkThreeStraight(h.headCards, h.midCards, h.tailCards)) {
                finalSpecial = { type: 'three_straight' as SpecialHand, score: 6, name: '三顺子' };
            }
        }

        // 评估三道
        const headResult = evaluateHead(h.headCards);
        const midResult = evaluateLane(h.midCards, 'mid');
        const tailResult = evaluateLane(h.tailCards, 'tail');

        // 二次验证乌龙（调用方可能已验证，这里做防御性检查）
        const isFoul = !validateArrangement(headResult, midResult, tailResult);

        if (isFoul) {
            const emptyResult: HandResult = {
                rank: 0 as any,
                sortKey: [],
                score: 0,
                name: '乌龙',
                resolvedCards: [],
            };
            return {
                userId: h.userId,
                headResult: emptyResult,
                midResult: emptyResult,
                tailResult: emptyResult,
                isFoul: true,
                specialHand: null,
                specialScore: 0,
                specialName: '',
            };
        }

        return {
            userId: h.userId,
            headResult,
            midResult,
            tailResult,
            isFoul: false,
            specialHand: finalSpecial.type,
            specialScore: finalSpecial.score,
            specialName: finalSpecial.name,
        };
    });
}

// ─── 核心结算逻辑 ────────────────────────────────────────────────

/**
 * 执行一局结算
 *
 * @param hands      所有玩家的手牌数据
 * @param ghostMultiplier 鬼牌倍率 (2^n)
 * @param baseScore  底分
 * @param compareSuit 是否比花色（影响同牌型同点数时是否比花色）
 */
export function settleRound(
    hands: PlayerHand[],
    ghostMultiplier: number,
    baseScore: number,
    _compareSuit: boolean = true,
): RoundSettlement {
    const evaluated = evaluatePlayers(hands);
    const playerIds = evaluated.map(p => p.userId);
    const n = playerIds.length;

    // 初始化每个玩家的结算数据
    const settlements: Map<string, PlayerSettlement> = new Map();
    for (const pid of playerIds) {
        settlements.set(pid, {
            userId: pid,
            rawScore: 0,
            finalScore: 0,
            gunsFired: 0,
            homerun: false,
            laneScores: [],
        });
    }

    // ─── Step 1: 处理报到牌型（特殊牌型） ─────────────────────────
    // 报到玩家直接从每个对手处拿分，不参与普通比牌
    const specialPlayers = new Set<string>();

    for (const player of evaluated) {
        if (player.specialHand && player.specialScore > 0) {
            specialPlayers.add(player.userId);
            const s = settlements.get(player.userId)!;

            for (const opponent of evaluated) {
                if (opponent.userId === player.userId) continue;
                const os = settlements.get(opponent.userId)!;

                // 对手也有报到牌型时：互相比报到分
                if (opponent.specialHand && opponent.specialScore > 0) {
                    // 不在这里处理互相比较，会在对手的循环中处理
                    // 这里只记录己方视角
                    const diff = player.specialScore - opponent.specialScore;
                    if (diff > 0) {
                        const record: LaneScoreRecord = {
                            lane: 'special',
                            userId: player.userId,
                            opponentId: opponent.userId,
                            score: diff,
                            detail: `${player.specialName}(${player.specialScore}) vs ${opponent.specialName}(${opponent.specialScore})`,
                        };
                        s.laneScores.push(record);
                        s.rawScore += diff;
                        os.rawScore -= diff;
                        os.laneScores.push({
                            ...record,
                            userId: opponent.userId,
                            opponentId: player.userId,
                            score: -diff,
                        });
                    }
                    // diff <= 0 会在对手循环中处理
                } else {
                    // 对手没有报到牌型，直接拿报到分
                    const score = player.specialScore;
                    const record: LaneScoreRecord = {
                        lane: 'special',
                        userId: player.userId,
                        opponentId: opponent.userId,
                        score,
                        detail: `${player.specialName} ${score}分`,
                    };
                    s.laneScores.push(record);
                    s.rawScore += score;
                    os.rawScore -= score;
                    os.laneScores.push({
                        ...record,
                        userId: opponent.userId,
                        opponentId: player.userId,
                        score: -score,
                    });
                }
            }
        }
    }

    // ─── Step 2: 逐道两两比较（非报到、非乌龙玩家之间） ──────────
    // 注意: 乌龙玩家当作"每道都输"处理
    const lanes: Lane[] = ['head', 'mid', 'tail'];

    // 记录每对玩家的胜负情况（用于打枪检测）
    // pairWins[A][B] = A 对 B 赢的道数
    const pairWins: Map<string, Map<string, number>> = new Map();
    for (const pid of playerIds) {
        pairWins.set(pid, new Map());
        for (const oid of playerIds) {
            if (pid !== oid) pairWins.get(pid)!.set(oid, 0);
        }
    }

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pA = evaluated[i];
            const pB = evaluated[j];

            // 两个都是报到牌型的已在 Step 1 处理
            if (specialPlayers.has(pA.userId) && specialPlayers.has(pB.userId)) continue;
            // 一个是报到牌型的也已在 Step 1 处理
            if (specialPlayers.has(pA.userId) || specialPlayers.has(pB.userId)) continue;

            const sA = settlements.get(pA.userId)!;
            const sB = settlements.get(pB.userId)!;

            for (const lane of lanes) {
                const resultA = lane === 'head' ? pA.headResult : lane === 'mid' ? pA.midResult : pA.tailResult;
                const resultB = lane === 'head' ? pB.headResult : lane === 'mid' ? pB.midResult : pB.tailResult;

                let cmp: number;
                if (pA.isFoul && pB.isFoul) {
                    cmp = 0; // 双方乌龙平手
                } else if (pA.isFoul) {
                    cmp = -1; // A乌龙，B赢
                } else if (pB.isFoul) {
                    cmp = 1;  // B乌龙，A赢
                } else {
                    cmp = compareHandResults(resultA, resultB);
                }

                if (cmp > 0) {
                    // A 赢 B
                    const laneScore = resultA.score; // 赢家道的得分
                    sA.rawScore += laneScore;
                    sB.rawScore -= laneScore;
                    sA.laneScores.push({
                        lane, userId: pA.userId, opponentId: pB.userId,
                        score: laneScore,
                        detail: `${resultA.name} 胜 ${resultB.name}`,
                    });
                    sB.laneScores.push({
                        lane, userId: pB.userId, opponentId: pA.userId,
                        score: -laneScore,
                        detail: `${resultB.name} 负 ${resultA.name}`,
                    });
                    pairWins.get(pA.userId)!.set(pB.userId, (pairWins.get(pA.userId)!.get(pB.userId) || 0) + 1);
                } else if (cmp < 0) {
                    // B 赢 A
                    const laneScore = resultB.score;
                    sB.rawScore += laneScore;
                    sA.rawScore -= laneScore;
                    sB.laneScores.push({
                        lane, userId: pB.userId, opponentId: pA.userId,
                        score: laneScore,
                        detail: `${resultB.name} 胜 ${resultA.name}`,
                    });
                    sA.laneScores.push({
                        lane, userId: pA.userId, opponentId: pB.userId,
                        score: -laneScore,
                        detail: `${resultA.name} 负 ${resultB.name}`,
                    });
                    pairWins.get(pB.userId)!.set(pA.userId, (pairWins.get(pB.userId)!.get(pA.userId) || 0) + 1);
                }
                // cmp === 0: 平手，不得分不扣分，也不计入打枪判定
            }
        }
    }

    // ─── Step 3: 打枪检测（三道全赢 → 该对手得分翻倍） ──────────
    // 打枪: A 对 B 三道全赢 (pairWins[A][B] === 3)
    // 效果: A 对 B 的三道得分再加一倍（即翻倍）

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const pA = evaluated[i];
            const pB = evaluated[j];
            if (specialPlayers.has(pA.userId) || specialPlayers.has(pB.userId)) continue;

            const sA = settlements.get(pA.userId)!;
            const sB = settlements.get(pB.userId)!;

            const winsAB = pairWins.get(pA.userId)!.get(pB.userId) || 0;
            const winsBA = pairWins.get(pB.userId)!.get(pA.userId) || 0;

            if (winsAB === 3) {
                // A 打枪 B: 计算 A 对 B 的三道总得分，再加一倍
                const pairScore = sA.laneScores
                    .filter(r => r.opponentId === pB.userId && (r.lane === 'head' || r.lane === 'mid' || r.lane === 'tail'))
                    .reduce((sum, r) => sum + r.score, 0);

                sA.rawScore += pairScore;
                sB.rawScore -= pairScore;
                sA.gunsFired++;

                sA.laneScores.push({
                    lane: 'gun',
                    userId: pA.userId,
                    opponentId: pB.userId,
                    score: pairScore,
                    detail: `打枪 +${pairScore}`,
                });
                sB.laneScores.push({
                    lane: 'gun',
                    userId: pB.userId,
                    opponentId: pA.userId,
                    score: -pairScore,
                    detail: `被打枪 -${pairScore}`,
                });
            } else if (winsBA === 3) {
                // B 打枪 A
                const pairScore = sB.laneScores
                    .filter(r => r.opponentId === pA.userId && (r.lane === 'head' || r.lane === 'mid' || r.lane === 'tail'))
                    .reduce((sum, r) => sum + r.score, 0);

                sB.rawScore += pairScore;
                sA.rawScore -= pairScore;
                sB.gunsFired++;

                sB.laneScores.push({
                    lane: 'gun',
                    userId: pB.userId,
                    opponentId: pA.userId,
                    score: pairScore,
                    detail: `打枪 +${pairScore}`,
                });
                sA.laneScores.push({
                    lane: 'gun',
                    userId: pA.userId,
                    opponentId: pB.userId,
                    score: -pairScore,
                    detail: `被打枪 -${pairScore}`,
                });
            }
        }
    }

    // ─── Step 4: 全垒打检测（打枪所有对手 → 所有得分再翻倍） ────
    // 全垒打: 对所有对手都打枪（n-1 个对手全打枪）

    for (const player of evaluated) {
        if (specialPlayers.has(player.userId)) continue;
        const s = settlements.get(player.userId)!;

        // 检查是否对每个非报到对手都打了枪
        const opponents = evaluated.filter(p => p.userId !== player.userId && !specialPlayers.has(p.userId));
        if (opponents.length === 0) continue;

        const allGunned = opponents.every(opp => {
            const wins = pairWins.get(player.userId)!.get(opp.userId) || 0;
            return wins === 3;
        });

        if (allGunned && opponents.length > 1) {
            // 全垒打: 当前 rawScore 再翻倍（在打枪基础上再加一倍）
            const currentScore = s.rawScore;
            s.rawScore += currentScore;
            s.homerun = true;

            // 从其他玩家扣除
            // 按比例分摊给各对手
            for (const opp of opponents) {
                const os = settlements.get(opp.userId)!;
                // 找出该对手贡献的分（负分）
                const oppContribution = os.laneScores
                    .filter(r => r.opponentId === player.userId)
                    .reduce((sum, r) => sum + r.score, 0);
                // oppContribution 是负数，再翻倍
                os.rawScore += oppContribution;

                s.laneScores.push({
                    lane: 'homerun',
                    userId: player.userId,
                    opponentId: opp.userId,
                    score: -oppContribution,
                    detail: `全垒打 +${-oppContribution}`,
                });
                os.laneScores.push({
                    lane: 'homerun',
                    userId: opp.userId,
                    opponentId: player.userId,
                    score: oppContribution,
                    detail: `被全垒打 ${oppContribution}`,
                });
            }
        }
    }

    // ─── Step 5: 应用鬼牌倍率和底分 ─────────────────────────────
    for (const [, s] of settlements) {
        s.finalScore = s.rawScore * ghostMultiplier * baseScore;
    }

    // ─── 零和校验 ─────────────────────────────────────────────────
    const total = Array.from(settlements.values()).reduce((sum, s) => sum + s.finalScore, 0);
    if (total !== 0) {
        throw new Error(`零和校验失败: 总分 = ${total}, 期望 0。结算数据异常，已阻止写入。`);
    }

    return {
        players: Array.from(settlements.values()),
        ghostMultiplier,
        baseScore,
    };
}
