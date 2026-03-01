import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

/**
 * GET /api/settlement/:gameId
 * 获取游戏结算数据（所有玩家的总买入、最终筹码、净盈亏）
 */
router.get('/:gameId', async (req, res) => {
    const { gameId } = req.params;

    // 游戏基本信息
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*, users!games_created_by_fkey(id, username)')
        .eq('id', gameId)
        .single();

    if (gameError || !game) {
        return res.status(404).json({ error: '游戏不存在' });
    }

    // 该游戏所有玩家
    const { data: players } = await supabase
        .from('game_players')
        .select('*, users(id, username)')
        .eq('game_id', gameId);

    // 该游戏的所有买入记录
    const { data: buyIns } = await supabase
        .from('buy_ins')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

    // 已有的结算记录
    const { data: settlements } = await supabase
        .from('settlements')
        .select('*')
        .eq('game_id', gameId);

    // 按用户聚合买入数据
    const playerStats: Record<string, {
        userId: string;
        username: string;
        totalBuyin: number;
        finalChips: number;
    }> = {};

    (players || []).forEach((p: any) => {
        playerStats[p.user_id] = {
            userId: p.user_id,
            username: p.users?.username || '未知',
            totalBuyin: 0,
            finalChips: 0,
        };
    });

    (buyIns || []).forEach((b: any) => {
        if (!playerStats[b.user_id]) return;
        if (b.type === 'initial' || b.type === 'rebuy') {
            playerStats[b.user_id].totalBuyin += b.amount;
        } else if (b.type === 'checkout') {
            playerStats[b.user_id].finalChips = b.amount;
        }
    });

    // 如果有已保存的结算记录，使用已保存的最终筹码
    (settlements || []).forEach((s: any) => {
        if (playerStats[s.user_id]) {
            playerStats[s.user_id].finalChips = s.final_chips;
            playerStats[s.user_id].totalBuyin = s.total_buyin;
        }
    });

    const stats = Object.values(playerStats).map(p => ({
        ...p,
        netProfit: p.finalChips - p.totalBuyin,
    }));

    return res.json({ game, stats, hasSettlement: (settlements || []).length > 0 });
});

/**
 * POST /api/settlement/:gameId
 * 提交最终结算（记录每个玩家的最终筹码）
 */
router.post('/:gameId', async (req, res) => {
    const { gameId } = req.params;
    const { userId, playerResults } = req.body;
    // playerResults: Array<{ userId, finalChips }>

    if (!userId) {
        return res.status(401).json({ error: '未授权的请求' });
    }

    // 验证是否为房主
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('created_by')
        .eq('id', gameId)
        .single();

    if (gameError || !game) {
        return res.status(404).json({ error: '游戏不存在' });
    }

    if (game.created_by !== userId) {
        return res.status(403).json({ error: '只有房主才能完成结算关闭房间' });
    }

    if (!Array.isArray(playerResults) || playerResults.length === 0) {
        return res.status(400).json({ error: '缺少玩家结算数据' });
    }

    // ── 验证：所有玩家都需要结账 ─────────────────────────────────────────
    // 获取该游戏的所有玩家
    const { data: players } = await supabase
        .from('game_players')
        .select('user_id, users(username)')
        .eq('game_id', gameId);

    // 获取所有买入与结账记录
    const { data: allBuyIns } = await supabase
        .from('buy_ins')
        .select('*')
        .eq('game_id', gameId);

    // 检查每个玩家是否有买入记录（有买入的才需要结账）
    const playersWithBuyIn = new Set(
        (allBuyIns || [])
            .filter((b: any) => b.type === 'initial' || b.type === 'rebuy')
            .map((b: any) => b.user_id)
    );

    // 检查哪些玩家已经结账
    const playersWithCheckout = new Set(
        (allBuyIns || [])
            .filter((b: any) => b.type === 'checkout')
            .map((b: any) => b.user_id)
    );

    // 找出还没结账的玩家
    const notCheckedOut: string[] = [];
    (players || []).forEach((p: any) => {
        if (playersWithBuyIn.has(p.user_id) && !playersWithCheckout.has(p.user_id)) {
            notCheckedOut.push(p.users?.username || p.user_id);
        }
    });

    if (notCheckedOut.length > 0) {
        return res.status(400).json({
            error: `以下玩家尚未结账，无法关闭房间：${notCheckedOut.join('、')}`,
            notCheckedOut
        });
    }

    // ── 验证：账单需要平账 ────────────────────────────────────────────────
    // 计算：总买入 vs 总结账筹码，差值不超过 1（允许积分舍入误差）
    const totalBuyInAmount = (allBuyIns || [])
        .filter((b: any) => b.type === 'initial' || b.type === 'rebuy')
        .reduce((sum: number, b: any) => sum + b.amount, 0);

    const submittedChipsTotal = playerResults.reduce((sum: number, p: any) => sum + (p.finalChips || 0), 0);

    if (Math.abs(submittedChipsTotal - totalBuyInAmount) > 1) {
        return res.status(400).json({
            error: `账单未平账！总买入: ${totalBuyInAmount} 积分，总剩余筹码: ${submittedChipsTotal} 积分，差异: ${submittedChipsTotal - totalBuyInAmount} 积分`,
            totalBuyIn: totalBuyInAmount,
            totalChips: submittedChipsTotal,
            diff: submittedChipsTotal - totalBuyInAmount
        });
    }

    // ── 计算每位玩家的总买入（用于结算） ─────────────────────────────────
    const buyInByUser: Record<string, number> = {};
    (allBuyIns || []).filter((b: any) => b.type === 'initial' || b.type === 'rebuy').forEach((b: any) => {
        buyInByUser[b.user_id] = (buyInByUser[b.user_id] || 0) + b.amount;
    });

    const settlementsToInsert = playerResults.map((p: { userId: string; finalChips: number }) => ({
        game_id: gameId,
        user_id: p.userId,
        final_chips: p.finalChips,
        total_buyin: buyInByUser[p.userId] || 0,
        net_profit: p.finalChips - (buyInByUser[p.userId] || 0),
    }));

    const { data, error } = await supabase
        .from('settlements')
        .upsert(settlementsToInsert, { onConflict: 'game_id,user_id' })
        .select();

    if (error) {
        console.error('[settlement/submit]', error);
        return res.status(500).json({ error: '结算提交失败' });
    }

    // 将游戏标记为已结束
    await supabase
        .from('games')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', gameId);

    // 广播结算完成事件，通知所有人跳转结算页
    import('../sse.js').then((sse) => {
        sse.broadcastToGame(gameId, 'game_settled', { message: '结算完成，正在跳转...' });
    });

    return res.json({ settlements: data });
});

export default router;
