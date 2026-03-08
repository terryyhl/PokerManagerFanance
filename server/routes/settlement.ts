import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

interface BuyInRecord {
    user_id: string;
    amount: number;
    type: string;
    created_at: string;
}

interface PlayerRecord {
    user_id: string;
    users?: { username: string } | { username: string }[] | null;
}

/** 从 Supabase join 结果中提取 username（可能是对象或数组） */
function extractUsername(users: PlayerRecord['users']): string {
    if (!users) return '未知';
    if (Array.isArray(users)) return users[0]?.username || '未知';
    return users.username || '未知';
}

/**
 * GET /api/settlement/:gameId
 * 获取游戏结算数据（所有玩家的总买入、最终筹码、净盈亏）
 */
router.get('/:gameId', async (req, res) => {
    try {
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

        // 该游戏的所有买入记录（按时间升序，确保 checkout 取最后一条）
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

        (players || []).forEach((p: PlayerRecord) => {
            playerStats[p.user_id] = {
                userId: p.user_id,
                username: extractUsername(p.users),
                totalBuyin: 0,
                finalChips: 0,
            };
        });

        // #17 fix: 按时间排序后遍历，checkout 取最后一条（因为已按 created_at 升序排列）
        (buyIns || []).forEach((b: BuyInRecord) => {
            if (!playerStats[b.user_id]) return;
            if (b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw') {
                playerStats[b.user_id].totalBuyin += b.amount;
            } else if (b.type === 'checkout') {
                // 取最后一条 checkout 记录（因为已按时间升序排列，后面的会覆盖前面的）
                playerStats[b.user_id].finalChips = b.amount;
            }
        });

        // 如果有已保存的结算记录，使用已保存的最终筹码
        (settlements || []).forEach((s: { user_id: string; final_chips: number; total_buyin: number }) => {
            if (playerStats[s.user_id]) {
                playerStats[s.user_id].finalChips = s.final_chips;
                playerStats[s.user_id].totalBuyin = s.total_buyin;
            }
        });

        const stats = Object.values(playerStats).map(p => ({
            ...p,
            netProfit: p.finalChips - p.totalBuyin,
        }));

        // 构建买入历史时间线（用于前端折线图）
        const buyInHistory = (buyIns || [])
            .filter((b: BuyInRecord) => b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw')
            .map((b: BuyInRecord) => ({
                userId: b.user_id,
                amount: b.amount,
                type: b.type,
                createdAt: b.created_at,
            }));

        return res.json({ game, stats, hasSettlement: (settlements || []).length > 0, buyInHistory });
    } catch (err) {
        console.error('[settlement/get] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * POST /api/settlement/:gameId
 * 提交最终结算（记录每个玩家的最终筹码）
 */
router.post('/:gameId', async (req, res) => {
    try {
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

        // 验证 playerResults 数据有效性
        for (const pr of playerResults) {
            if (!pr.userId || typeof pr.finalChips !== 'number' || pr.finalChips < 0) {
                return res.status(400).json({ error: '玩家结算数据格式不正确' });
            }
        }

        // ── 获取买入数据 ──────────────────────────────────────────────────────
        const { data: allBuyIns } = await supabase
            .from('buy_ins')
            .select('*')
            .eq('game_id', gameId);

        // ── 验证：账单需要平账 ────────────────────────────────────────────────
        // 房主提交的 playerResults 中的 finalChips 即为最终筹码（不强制要求每个玩家自行结账）
        const totalBuyInAmount = (allBuyIns || [])
            .filter((b: BuyInRecord) => b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw')
            .reduce((sum: number, b: BuyInRecord) => sum + b.amount, 0);

        const submittedChipsTotal = playerResults.reduce((sum: number, p: { finalChips: number }) => sum + (p.finalChips || 0), 0);

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
        (allBuyIns || [])
            .filter((b: BuyInRecord) => b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw')
            .forEach((b: BuyInRecord) => {
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

        return res.json({ settlements: data });
    } catch (err) {
        console.error('[settlement/submit] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
