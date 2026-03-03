/**
 * 13水 API 路由
 *
 * POST /api/thirteen/:gameId/start-round     房主开始新一轮
 * POST /api/thirteen/:gameId/set-public-cards 房主设置6张公共牌
 * POST /api/thirteen/:gameId/submit-hand      玩家提交摆牌
 * POST /api/thirteen/:gameId/settle           所有人确认后结算
 * GET  /api/thirteen/:gameId/round/:roundId   获取某轮详情
 * GET  /api/thirteen/:gameId/history          获取所有轮次历史
 * GET  /api/thirteen/:gameId/totals           获取累计总分
 */

import { Router } from 'express';
import { supabase } from '../supabase.js';
import { Card, isValidCard, isGhost, calcGhostMultiplier } from '../lib/thirteen/deck.js';
import { evaluateHead, evaluateLane, validateArrangement, detectSpecialHand, checkThreeFlush, checkThreeStraight } from '../lib/thirteen/hands.js';
import { settleRound, PlayerHand } from '../lib/thirteen/scoring.js';
import { autoArrange } from '../lib/thirteen/arrange.js';

const router = Router();

// ─── 辅助函数 ────────────────────────────────────────────────────

/** 验证 userId 是否是该游戏的房主 */
async function isHost(gameId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('games')
        .select('created_by')
        .eq('id', gameId)
        .single();
    return data?.created_by === userId;
}

/** 获取游戏的13水配置 */
async function getGameConfig(gameId: string) {
    const { data, error } = await supabase
        .from('games')
        .select('room_type, thirteen_base_score, thirteen_ghost_count, thirteen_compare_suit, thirteen_max_players, thirteen_time_limit, status')
        .eq('id', gameId)
        .single();
    if (error || !data) return null;
    return data;
}

/** 获取游戏的当前玩家列表 */
async function getGamePlayers(gameId: string): Promise<string[]> {
    const { data } = await supabase
        .from('game_players')
        .select('user_id')
        .eq('game_id', gameId);
    return (data || []).map(r => r.user_id);
}

// ─── POST /start-round ──────────────────────────────────────────

/**
 * 房主开始新一轮
 * Body: { userId }
 * 流程: 创建 thirteen_rounds 行，status='arranging'
 */
router.post('/:gameId/start-round', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.body;

        if (!userId) return res.status(400).json({ error: '缺少 userId' });

        // 验证房主身份
        if (!(await isHost(gameId, userId))) {
            return res.status(403).json({ error: '只有房主可以开始新一轮' });
        }

        // 验证是13水房间且活跃
        const config = await getGameConfig(gameId);
        if (!config || config.room_type !== 'thirteen') {
            return res.status(400).json({ error: '该房间不是13水房间' });
        }
        if (config.status !== 'active') {
            return res.status(400).json({ error: '该房间已结束' });
        }

        // 检查是否有未完成的轮次
        const { data: activeRound } = await supabase
            .from('thirteen_rounds')
            .select('id, status')
            .eq('game_id', gameId)
            .not('status', 'eq', 'finished')
            .limit(1)
            .single();

        if (activeRound) {
            return res.status(400).json({ error: '当前轮次尚未结束', roundId: activeRound.id });
        }

        // 获取最大轮次号
        const { data: lastRound } = await supabase
            .from('thirteen_rounds')
            .select('round_number')
            .eq('game_id', gameId)
            .order('round_number', { ascending: false })
            .limit(1)
            .single();

        const nextRoundNumber = (lastRound?.round_number || 0) + 1;

        // 创建新轮次
        const { data: newRound, error: insertError } = await supabase
            .from('thirteen_rounds')
            .insert({
                game_id: gameId,
                round_number: nextRoundNumber,
                status: 'arranging',
                public_cards: [],
                ghost_count: 0,
                ghost_multiplier: 1,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[thirteen/start-round]', insertError);
            return res.status(500).json({ error: '开始新一轮失败' });
        }

        return res.status(201).json({ round: newRound });
    } catch (err) {
        console.error('[thirteen/start-round] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── POST /set-ghost-count ──────────────────────────────────────

/**
 * 房主设置本轮公共区鬼牌数量
 * Body: { userId, roundId, ghostCount: number }
 * ghostCount 范围 0 ~ thirteen_ghost_count(游戏配置)
 * 倍率 = 2^ghostCount
 */
router.post('/:gameId/set-ghost-count', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, roundId, ghostCount } = req.body;

        if (!userId || !roundId || ghostCount === undefined) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        if (!(await isHost(gameId, userId))) {
            return res.status(403).json({ error: '只有房主可以设置鬼牌' });
        }

        const config = await getGameConfig(gameId);
        if (!config) return res.status(404).json({ error: '房间不存在' });

        const maxGhost = config.thirteen_ghost_count || 6;
        const count = Math.max(0, Math.min(Number(ghostCount), maxGhost));
        const multiplier = Math.pow(2, count);

        const { data: round, error: updateError } = await supabase
            .from('thirteen_rounds')
            .update({
                public_cards: [],
                ghost_count: count,
                ghost_multiplier: multiplier,
            })
            .eq('id', roundId)
            .eq('game_id', gameId)
            .select()
            .single();

        if (updateError) {
            console.error('[thirteen/set-ghost-count]', updateError);
            return res.status(500).json({ error: '设置鬼牌失败' });
        }

        return res.json({ round });
    } catch (err) {
        console.error('[thirteen/set-ghost-count] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── POST /set-public-cards ─────────────────────────────────────

/**
 * 房主设置公共牌（0~6张）
 * Body: { userId, roundId, publicCards: string[] }
 * 系统自动统计鬼牌数量并计算倍率 2^ghostCount
 */
router.post('/:gameId/set-public-cards', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, roundId, publicCards } = req.body;

        if (!userId || !roundId || !Array.isArray(publicCards)) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 验证房主
        if (!(await isHost(gameId, userId))) {
            return res.status(403).json({ error: '只有房主可以设置公共牌' });
        }

        // 验证公共牌数量（0~6张）和合法性
        if (publicCards.length > 6) {
            return res.status(400).json({ error: '公共牌最多6张' });
        }

        for (const card of publicCards) {
            if (!isValidCard(card)) {
                return res.status(400).json({ error: `无效的牌: ${card}` });
            }
        }

        // 检查公共牌中鬼牌数量不超过游戏配置的最大鬼牌数
        const config = await getGameConfig(gameId);
        if (!config) return res.status(404).json({ error: '房间不存在' });

        const publicGhostCount = publicCards.filter((c: string) => isGhost(c)).length;
        const maxGhost = config.thirteen_ghost_count || 6;
        if (publicGhostCount > maxGhost) {
            return res.status(400).json({ error: `鬼牌数量(${publicGhostCount})超过配置(${maxGhost})` });
        }

        // 计算鬼牌倍率
        const multiplier = Math.pow(2, publicGhostCount);

        // 更新轮次
        const { data: round, error: updateError } = await supabase
            .from('thirteen_rounds')
            .update({
                public_cards: publicCards,
                ghost_count: publicGhostCount,
                ghost_multiplier: multiplier,
            })
            .eq('id', roundId)
            .eq('game_id', gameId)
            .select()
            .single();

        if (updateError) {
            console.error('[thirteen/set-public-cards]', updateError);
            return res.status(500).json({ error: '设置公共牌失败' });
        }

        return res.json({ round });
    } catch (err) {
        console.error('[thirteen/set-public-cards] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── POST /auto-arrange ─────────────────────────────────────────

/**
 * 自动摆牌：给定13张牌，返回最优的 3+5+5 分配方案
 * Body: { cards: string[] }  — 13张牌编码
 */
router.post('/:gameId/auto-arrange', async (req, res) => {
    try {
        const { cards } = req.body;

        if (!Array.isArray(cards) || cards.length !== 13) {
            return res.status(400).json({ error: '需要13张牌' });
        }

        // 验证牌编码合法
        for (const card of cards) {
            if (!isValidCard(card)) {
                return res.status(400).json({ error: `无效的牌: ${card}` });
            }
        }

        // 验证无重复
        if (new Set(cards).size !== 13) {
            return res.status(400).json({ error: '牌不能重复' });
        }

        const result = autoArrange(cards);

        return res.json({
            head: result.head,
            mid: result.mid,
            tail: result.tail,
            headName: result.headResult.name,
            midName: result.midResult.name,
            tailName: result.tailResult.name,
            totalScore: result.totalScore,
            valid: result.valid,
        });
    } catch (err) {
        console.error('[thirteen/auto-arrange] Unhandled:', err);
        return res.status(500).json({ error: '自动摆牌失败' });
    }
});

// ─── POST /save-draft ───────────────────────────────────────────

/**
 * 自动保存摆牌草稿（未确认）
 * Body: { userId, roundId, headCards: string[], midCards: string[], tailCards: string[] }
 * 轻量接口，不做乌龙/牌型检测，只做基本校验后写入 is_confirmed=false
 */
router.post('/:gameId/save-draft', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, roundId, headCards, midCards, tailCards } = req.body;

        if (!userId || !roundId || !Array.isArray(headCards) || !Array.isArray(midCards) || !Array.isArray(tailCards)) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 基本上限校验
        if (headCards.length > 3 || midCards.length > 5 || tailCards.length > 5) {
            return res.status(400).json({ error: '牌数量超限' });
        }

        // 验证轮次存在且状态为 arranging
        const { data: round } = await supabase
            .from('thirteen_rounds')
            .select('id, status')
            .eq('id', roundId)
            .eq('game_id', gameId)
            .single();

        if (!round || round.status !== 'arranging') {
            return res.status(400).json({ error: '当前不在摆牌阶段' });
        }

        // 如果该玩家已确认，不允许覆盖草稿
        const { data: existing } = await supabase
            .from('thirteen_hands')
            .select('is_confirmed')
            .eq('round_id', roundId)
            .eq('user_id', userId)
            .single();

        if (existing?.is_confirmed) {
            return res.json({ ok: true, skipped: true });
        }

        // Upsert 草稿
        const { error: upsertError } = await supabase
            .from('thirteen_hands')
            .upsert({
                round_id: roundId,
                user_id: userId,
                head_cards: headCards,
                mid_cards: midCards,
                tail_cards: tailCards,
                is_confirmed: false,
                is_foul: false,
                special_hand: null,
            }, { onConflict: 'round_id,user_id' });

        if (upsertError) {
            console.error('[thirteen/save-draft]', upsertError);
            return res.status(500).json({ error: '保存草稿失败' });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error('[thirteen/save-draft] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── POST /submit-hand ──────────────────────────────────────────

/**
 * 玩家提交摆牌
 * Body: { userId, roundId, headCards: string[], midCards: string[], tailCards: string[] }
 *
 * 服务端验证:
 *   - 至少选1张牌
 *   - 头道0~3张, 中道0~5张, 尾道0~5张
 *   - 牌编码合法
 *   - 无重复牌
 *   - 不满13张或不满道次上限 → 自动乌龙
 *   - 乌龙检测（尾道 >= 中道 >= 头道）
 */
router.post('/:gameId/submit-hand', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, roundId, headCards, midCards, tailCards } = req.body;

        if (!userId || !roundId || !Array.isArray(headCards) || !Array.isArray(midCards) || !Array.isArray(tailCards)) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 验证牌数量（允许空道次，但每道不超过上限）
        if (headCards.length > 3) return res.status(400).json({ error: '头道最多3张牌' });
        if (midCards.length > 5) return res.status(400).json({ error: '中道最多5张牌' });
        if (tailCards.length > 5) return res.status(400).json({ error: '尾道最多5张牌' });

        const allCards = [...headCards, ...midCards, ...tailCards];
        if (allCards.length === 0) return res.status(400).json({ error: '至少选1张牌' });

        // 验证牌编码合法
        for (const card of allCards) {
            if (!isValidCard(card)) {
                return res.status(400).json({ error: `无效的牌: ${card}` });
            }
        }

        // 验证无重复牌
        const cardSet = new Set(allCards);
        if (cardSet.size !== allCards.length) {
            return res.status(400).json({ error: '牌不能重复' });
        }

        // 验证玩家是该游戏的成员
        const players = await getGamePlayers(gameId);
        if (!players.includes(userId)) {
            return res.status(403).json({ error: '你不是该房间的成员' });
        }

        // 验证轮次存在且状态为 arranging
        const { data: round, error: roundErr } = await supabase
            .from('thirteen_rounds')
            .select('id, status')
            .eq('id', roundId)
            .eq('game_id', gameId)
            .single();

        if (roundErr || !round) {
            return res.status(404).json({ error: '轮次不存在' });
        }
        if (round.status !== 'arranging') {
            return res.status(400).json({ error: '当前轮次不在摆牌阶段' });
        }

        // 评估牌型并检测乌龙
        let isFoul = false;
        let specialHand: string | null = null;

        try {
            const headResult = evaluateHead(headCards);
            const midResult = evaluateLane(midCards, 'mid');
            const tailResult = evaluateLane(tailCards, 'tail');
            isFoul = !validateArrangement(headResult, midResult, tailResult);
        } catch {
            isFoul = true;
        }

        // 检测报到牌型
        if (!isFoul) {
            const special = detectSpecialHand(allCards);
            if (special.type) {
                specialHand = special.type;
            } else if (checkThreeFlush(headCards, midCards, tailCards)) {
                specialHand = 'three_flush';
            } else if (checkThreeStraight(headCards, midCards, tailCards)) {
                specialHand = 'three_straight';
            }
        }

        // Upsert: 玩家可以在确认前重新摆牌
        const { data: hand, error: upsertError } = await supabase
            .from('thirteen_hands')
            .upsert({
                round_id: roundId,
                user_id: userId,
                head_cards: headCards,
                mid_cards: midCards,
                tail_cards: tailCards,
                is_confirmed: true,
                is_foul: isFoul,
                special_hand: specialHand,
                confirmed_at: new Date().toISOString(),
            }, { onConflict: 'round_id,user_id' })
            .select()
            .single();

        if (upsertError) {
            console.error('[thirteen/submit-hand]', upsertError);
            return res.status(500).json({ error: '提交摆牌失败' });
        }

        // 检查是否所有玩家都已确认
        const { count: confirmedCount } = await supabase
            .from('thirteen_hands')
            .select('*', { count: 'exact', head: true })
            .eq('round_id', roundId)
            .eq('is_confirmed', true);

        const allConfirmed = confirmedCount !== null && confirmedCount >= players.length;

        return res.json({
            hand,
            isFoul,
            specialHand,
            allConfirmed,
            confirmedCount: confirmedCount || 0,
            totalPlayers: players.length,
        });
    } catch (err) {
        console.error('[thirteen/submit-hand] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── POST /settle ───────────────────────────────────────────────

/**
 * 结算当前轮次
 * Body: { userId, roundId }
 *
 * 只有所有玩家都确认后才能结算。
 * 结算流程:
 *   1. 收集所有玩家的摆牌数据
 *   2. 调用 settleRound() 执行结算
 *   3. 写入 thirteen_scores（明细）和 thirteen_totals（汇总）
 *   4. 更新 thirteen_rounds.status = 'finished'
 */
router.post('/:gameId/settle', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, roundId } = req.body;
        console.log('[settle] 开始, gameId=', gameId, 'roundId=', roundId, 'userId=', userId);

        if (!userId || !roundId) return res.status(400).json({ error: '缺少必要参数' });

        // 验证是房间成员
        const memberIds = await getGamePlayers(gameId);
        console.log('[settle] memberIds=', memberIds.length, memberIds);
        if (!memberIds.includes(userId)) {
            return res.status(403).json({ error: '你不是该房间的成员' });
        }

        // 获取游戏配置
        const config = await getGameConfig(gameId);
        if (!config) return res.status(404).json({ error: '房间不存在' });

        // 获取轮次
        const { data: round, error: roundErr } = await supabase
            .from('thirteen_rounds')
            .select('*')
            .eq('id', roundId)
            .eq('game_id', gameId)
            .single();

        if (roundErr || !round) {
            console.error('[settle] 轮次不存在, roundErr=', roundErr);
            return res.status(404).json({ error: '轮次不存在' });
        }
        console.log('[settle] round.status=', round.status);

        // 已完成的轮次：直接返回已有结算结果（支持重连恢复）
        if (round.status === 'finished') {
            console.log('[settle] 轮次已完成，返回已有结果');
            const { data: totals } = await supabase
                .from('thirteen_totals')
                .select('*')
                .eq('round_id', roundId);
            const { data: scores } = await supabase
                .from('thirteen_scores')
                .select('*')
                .eq('round_id', roundId);
            const settlementPlayers = (totals || []).map((t: any) => ({
                userId: t.user_id,
                rawScore: t.raw_score,
                finalScore: t.final_score,
                gunsFired: t.guns_fired,
                homerun: t.homerun,
                laneScores: (scores || [])
                    .filter((s: any) => s.user_id === t.user_id)
                    .map((s: any) => ({ lane: s.lane, userId: s.user_id, opponentId: s.opponent_id, score: s.score, detail: s.detail })),
            }));
            return res.json({ settlement: { players: settlementPlayers }, alreadyFinished: true });
        }

        // 非 finished 的轮次，统一执行结算（清理可能的残留数据后重新计算）
        // 先尝试 CAS arranging → settling（防并发），如果状态已经不是 arranging 则强制进入
        const { data: casResult } = await supabase
            .from('thirteen_rounds')
            .update({ status: 'settling' })
            .eq('id', roundId)
            .in('status', ['arranging', 'settling', 'revealing'])
            .select('id')
            .single();
        console.log('[settle] CAS →settling:', !!casResult, 'from status=', round.status);

        // 清理可能的残留数据（上次结算中断或重复调用）
        console.log('[settle] 清理残留 scores/totals...');
        await supabase.from('thirteen_scores').delete().eq('round_id', roundId);
        await supabase.from('thirteen_totals').delete().eq('round_id', roundId);

        const players = memberIds;

        // 获取所有已确认的手牌
        const { data: hands, error: handsErr } = await supabase
            .from('thirteen_hands')
            .select('*')
            .eq('round_id', roundId)
            .eq('is_confirmed', true);

        if (handsErr || !hands) {
            console.error('[settle] 获取手牌失败:', handsErr);
            return res.status(500).json({ error: '获取手牌数据失败' });
        }
        console.log('[settle] confirmed hands=', hands.length, '/', players.length);

        if (hands.length < players.length) {
            console.warn('[settle] 未全员确认:', hands.length, '<', players.length);
            // 回滚状态到 arranging，避免永远卡在 settling
            await supabase.from('thirteen_rounds').update({ status: 'arranging' }).eq('id', roundId);
            return res.status(400).json({
                error: `还有${players.length - hands.length}位玩家未确认摆牌`,
                confirmed: hands.length,
                total: players.length,
            });
        }

        // 构建 PlayerHand 数据
        const playerHands: PlayerHand[] = hands.map(h => ({
            userId: h.user_id,
            allCards: [...(h.head_cards || []), ...(h.mid_cards || []), ...(h.tail_cards || [])],
            headCards: h.head_cards || [],
            midCards: h.mid_cards || [],
            tailCards: h.tail_cards || [],
            isFoul: h.is_foul || false,
        }));
        console.log('[settle] playerHands 构建完成, count=', playerHands.length);

        // 执行结算
        const ghostMultiplier = round.ghost_multiplier || 1;
        const baseScore = config.thirteen_base_score || 1;
        const compareSuit = config.thirteen_compare_suit !== false;

        console.log('[settle] 执行 settleRound, ghostMultiplier=', ghostMultiplier, 'baseScore=', baseScore);
        const settlement = settleRound(playerHands, ghostMultiplier, baseScore, compareSuit);
        console.log('[settle] settleRound 完成, players=', settlement.players.length);

        // 写入 thirteen_scores（明细）
        const scoreRecords = settlement.players.flatMap(p =>
            p.laneScores.map(ls => ({
                round_id: roundId,
                user_id: ls.userId,
                opponent_id: ls.opponentId,
                lane: ls.lane,
                score: ls.score,
                detail: ls.detail,
            }))
        );

        if (scoreRecords.length > 0) {
            const { error: scoreErr } = await supabase
                .from('thirteen_scores')
                .insert(scoreRecords);
            if (scoreErr) {
                console.error('[settle] 写入明细失败:', scoreErr);
                return res.status(500).json({ error: '写入结算明细失败', detail: scoreErr.message });
            }
        }
        console.log('[settle] scores 写入成功, count=', scoreRecords.length);

        // 写入 thirteen_totals（汇总）
        const totalRecords = settlement.players.map(p => ({
            round_id: roundId,
            user_id: p.userId,
            raw_score: p.rawScore,
            final_score: p.finalScore,
            guns_fired: p.gunsFired,
            homerun: p.homerun,
        }));

        const { error: totalErr } = await supabase
            .from('thirteen_totals')
            .upsert(totalRecords, { onConflict: 'round_id,user_id' });

        if (totalErr) {
            console.error('[settle] 写入汇总失败:', totalErr);
            return res.status(500).json({ error: '写入结算汇总失败', detail: totalErr.message });
        }
        console.log('[settle] totals 写入成功');

        // 更新轮次状态为完成
        await supabase
            .from('thirteen_rounds')
            .update({ status: 'finished', finished_at: new Date().toISOString() })
            .eq('id', roundId);
        console.log('[settle] round 状态更新为 finished');

        return res.json({ settlement });
    } catch (err) {
        console.error('[settle] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误', detail: String(err) });
    }
});

// ─── GET /round/:roundId ────────────────────────────────────────

/**
 * 获取某轮的详细信息（含所有手牌、得分）
 */
router.get('/:gameId/round/:roundId', async (req, res) => {
    try {
        const { gameId, roundId } = req.params;

        // 获取轮次信息
        const { data: round, error: roundErr } = await supabase
            .from('thirteen_rounds')
            .select('*')
            .eq('id', roundId)
            .eq('game_id', gameId)
            .single();

        if (roundErr || !round) return res.status(404).json({ error: '轮次不存在' });

        // 获取手牌
        const { data: hands } = await supabase
            .from('thirteen_hands')
            .select('*, users(id, username)')
            .eq('round_id', roundId);

        // 获取得分明细
        const { data: scores } = await supabase
            .from('thirteen_scores')
            .select('*')
            .eq('round_id', roundId);

        // 获取汇总
        const { data: totals } = await supabase
            .from('thirteen_totals')
            .select('*, users(id, username)')
            .eq('round_id', roundId);

        return res.json({ round, hands: hands || [], scores: scores || [], totals: totals || [] });
    } catch (err) {
        console.error('[thirteen/round] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── GET /history ───────────────────────────────────────────────

/**
 * 获取该游戏的所有轮次历史
 */
router.get('/:gameId/history', async (req, res) => {
    try {
        const { gameId } = req.params;

        const { data: rounds, error } = await supabase
            .from('thirteen_rounds')
            .select('*')
            .eq('game_id', gameId)
            .order('round_number', { ascending: true });

        if (error) return res.status(500).json({ error: '获取历史失败' });

        // 批量获取每轮的汇总数据
        const roundIds = (rounds || []).map(r => r.id);
        let totals: any[] = [];
        if (roundIds.length > 0) {
            const { data } = await supabase
                .from('thirteen_totals')
                .select('*, users(id, username)')
                .in('round_id', roundIds);
            totals = data || [];
        }

        // 将 totals 按 round_id 分组
        const totalsByRound: Record<string, any[]> = {};
        for (const t of totals) {
            if (!totalsByRound[t.round_id]) totalsByRound[t.round_id] = [];
            totalsByRound[t.round_id].push(t);
        }

        const result = (rounds || []).map(r => ({
            ...r,
            totals: totalsByRound[r.id] || [],
        }));

        return res.json({ rounds: result });
    } catch (err) {
        console.error('[thirteen/history] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── GET /totals ────────────────────────────────────────────────

/**
 * 获取该游戏的累计总分（所有轮次汇总）
 */
router.get('/:gameId/totals', async (req, res) => {
    try {
        const { gameId } = req.params;

        // 获取所有已完成轮次的 id
        const { data: rounds } = await supabase
            .from('thirteen_rounds')
            .select('id')
            .eq('game_id', gameId)
            .eq('status', 'finished');

        const roundIds = (rounds || []).map(r => r.id);
        if (roundIds.length === 0) {
            return res.json({ totals: [] });
        }

        // 获取所有汇总记录
        const { data: allTotals } = await supabase
            .from('thirteen_totals')
            .select('user_id, final_score, guns_fired, homerun, users(id, username)')
            .in('round_id', roundIds);

        // 按玩家汇总
        const userMap: Record<string, { userId: string; username: string; totalScore: number; totalGuns: number; homeruns: number; rounds: number }> = {};
        for (const t of (allTotals || [])) {
            const uid = t.user_id;
            if (!userMap[uid]) {
                userMap[uid] = {
                    userId: uid,
                    username: (t.users as any)?.username || '未知',
                    totalScore: 0,
                    totalGuns: 0,
                    homeruns: 0,
                    rounds: 0,
                };
            }
            userMap[uid].totalScore += t.final_score;
            userMap[uid].totalGuns += t.guns_fired;
            if (t.homerun) userMap[uid].homeruns++;
            userMap[uid].rounds++;
        }

        const totals = Object.values(userMap).sort((a, b) => b.totalScore - a.totalScore);

        return res.json({ totals, roundCount: roundIds.length });
    } catch (err) {
        console.error('[thirteen/totals] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// ─── GET /state ─────────────────────────────────────────────

/**
 * 获取该游戏的当前状态（用于进入房间时同步进度）
 * 返回: 当前活跃轮次(如有)、所有手牌确认状态、累计总分
 */
router.get('/:gameId/state', async (req, res) => {
    try {
        const { gameId } = req.params;

        // 获取当前活跃轮次（未结束的），如果没有则取最近一轮（可能刚结算完）
        let activeRound: any = null;
        const { data: pendingRound } = await supabase
            .from('thirteen_rounds')
            .select('*')
            .eq('game_id', gameId)
            .not('status', 'eq', 'finished')
            .order('round_number', { ascending: false })
            .limit(1)
            .single();
        if (pendingRound) {
            activeRound = pendingRound;
        }
        // 已结算的轮次不再作为 activeRound 返回，结算完成即进入等待状态

        let hands: any[] = [];
        if (activeRound) {
            // 获取该轮所有手牌
            const { data: handsData } = await supabase
                .from('thirteen_hands')
                .select('*, users(id, username)')
                .eq('round_id', activeRound.id);
            hands = handsData || [];
        }

        // 获取已完成轮次数
        const { count: finishedCount } = await supabase
            .from('thirteen_rounds')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', gameId)
            .eq('status', 'finished');

        // 获取累计总分
        const { data: rounds } = await supabase
            .from('thirteen_rounds')
            .select('id')
            .eq('game_id', gameId)
            .eq('status', 'finished');

        const roundIds = (rounds || []).map(r => r.id);
        let playerTotals: Record<string, number> = {};
        if (roundIds.length > 0) {
            const { data: allTotals } = await supabase
                .from('thirteen_totals')
                .select('user_id, final_score')
                .in('round_id', roundIds);
            for (const t of (allTotals || [])) {
                playerTotals[t.user_id] = (playerTotals[t.user_id] || 0) + t.final_score;
            }
        }

        // 获取玩家总数
        const playerIds = await getGamePlayers(gameId);

        return res.json({
            activeRound: activeRound || null,
            hands,
            finishedRounds: finishedCount || 0,
            playerTotals,
            totalPlayers: playerIds.length,
        });
    } catch (err) {
        console.error('[thirteen/state] Unhandled:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
