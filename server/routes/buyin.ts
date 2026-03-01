import { Router } from 'express';
import { supabase } from '../supabase.js';
import { addPending, removePending, getPending } from '../pendingRequests.js';

const router = Router();

/**
 * POST /api/buyin
 * 直接买入（非审核模式 or 房主）
 * 成功后广播 game_refresh 给所有房间用户
 */
router.post('/', async (req, res) => {
    try {
        const { gameId, userId, amount, type } = req.body;

        if (!gameId || !userId || !amount) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // #15 输入验证
        const parsedAmount = parseInt(amount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: '买入金额必须为正整数' });
        }

        const validType = type === 'rebuy' ? 'rebuy' : 'initial';

        const { data, error } = await supabase
            .from('buy_ins')
            .insert({
                game_id: gameId,
                user_id: userId,
                amount: parsedAmount,
                type: validType,
            })
            .select(`*, users(id, username)`)
            .single();

        if (error) {
            console.error('[buyin/create]', error);
            return res.status(500).json({ error: '买入记录提交失败' });
        }

        // 确保玩家在 game_players 中
        await supabase
            .from('game_players')
            .upsert({ game_id: gameId, user_id: userId }, { onConflict: 'game_id,user_id' });

        // 计算当前总买入
        const { data: allUserBuyins } = await supabase
            .from('buy_ins')
            .select('amount')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .in('type', ['initial', 'rebuy']);

        const totalAmount = (allUserBuyins || []).reduce((sum, b) => sum + b.amount, 0);

        return res.status(201).json({ buyIn: data, totalAmount });
    } catch (err: unknown) {
        console.error('[buyin/create] Unhandled error:', err);
        const message = err instanceof Error ? err.message : '服务器内部错误';
        return res.status(500).json({ error: message });
    }
});

/**
 * GET /api/buyin/player/:gameId/:userId
 * 获取某个玩家在某局游戏中的买入记录（供前端 PlayerStatsModal 使用）
 */
router.get('/player/:gameId/:userId', async (req, res) => {
    try {
        const { gameId, userId } = req.params;

        const { data, error } = await supabase
            .from('buy_ins')
            .select('amount, type, created_at')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[buyin/player]', error);
            return res.status(500).json({ error: '获取玩家买入记录失败' });
        }

        return res.json({ buyIns: data || [] });
    } catch (err: unknown) {
        console.error('[buyin/player] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * POST /api/buyin/pending
 * 提交待审核买入申请（带入审核模式下，非房主用户使用）
 */
router.post('/pending', async (req, res) => {
    try {
        const { gameId, userId, username, amount, type } = req.body;

        if (!gameId || !userId || !username || !amount) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // #15 输入验证
        const parsedAmount = parseInt(amount, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: '买入金额必须为正整数' });
        }

        // 计算当前总买入，用于房主审核时参考
        const { data: allUserBuyins } = await supabase
            .from('buy_ins')
            .select('amount')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .in('type', ['initial', 'rebuy']);

        const currentTotal = (allUserBuyins || []).reduce((sum, b) => sum + b.amount, 0);

        const pending = await addPending({
            gameId,
            userId,
            username,
            amount: parsedAmount,
            totalBuyIn: currentTotal,
            type: type === 'rebuy' ? 'rebuy' : 'initial',
        });

        return res.status(201).json({ request: pending });
    } catch (err: unknown) {
        console.error('[buyin/pending] Unhandled error:', err);
        const message = err instanceof Error ? err.message : '提交申请时发生错误';
        return res.status(500).json({ error: message });
    }
});

/**
 * GET /api/buyin/pending/:gameId
 * 获取当前游戏所有待审核申请（房主使用）
 */
router.get('/pending/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const requests = await getPending(gameId);
        return res.json({ requests });
    } catch (err: unknown) {
        console.error('[buyin/pending/list] error:', err);
        return res.status(500).json({ error: '获取申请列表失败' });
    }
});

/**
 * POST /api/buyin/pending/:id/approve
 * 房主批准买入申请：写入 DB + 通知申请用户
 */
router.post('/pending/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        const pending = await removePending(id);
        if (!pending) {
            return res.status(404).json({ error: '申请不存在或已处理' });
        }

        const { data, error } = await supabase
            .from('buy_ins')
            .insert({
                game_id: pending.gameId,
                user_id: pending.userId,
                amount: pending.amount,
                type: pending.type,
            })
            .select(`*, users(id, username)`)
            .single();

        if (error) {
            console.error('[buyin/approve]', error);
            return res.status(500).json({ error: '买入审批写入失败' });
        }

        await supabase
            .from('game_players')
            .upsert({ game_id: pending.gameId, user_id: pending.userId }, { onConflict: 'game_id,user_id' });

        // 计算当前总买入
        const { data: allUserBuyins } = await supabase
            .from('buy_ins')
            .select('amount')
            .eq('game_id', pending.gameId)
            .eq('user_id', pending.userId)
            .in('type', ['initial', 'rebuy']);

        const totalAmount = (allUserBuyins || []).reduce((sum, b) => sum + b.amount, 0);

        return res.status(201).json({ buyIn: data, totalAmount });
    } catch (err: unknown) {
        console.error('[buyin/approve] Unhandled error:', err);
        const message = err instanceof Error ? err.message : '审批处理时发生错误';
        return res.status(500).json({ error: message });
    }
});

/**
 * DELETE /api/buyin/pending/:id
 * 房主拒绝买入申请
 */
router.delete('/pending/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const pending = await removePending(id);
        if (!pending) {
            return res.status(404).json({ error: '申请不存在或已处理' });
        }

        return res.json({ success: true });
    } catch (err: unknown) {
        console.error('[buyin/pending/reject] error:', err);
        return res.status(500).json({ error: '拒绝申请失败' });
    }
});

/**
 * POST /api/buyin/checkout
 * 结账：防止重复结账
 */
router.post('/checkout', async (req, res) => {
    try {
        const { gameId, userId, chips } = req.body;

        if (!gameId || !userId || chips === undefined) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // #15 输入验证
        const parsedChips = parseInt(chips, 10);
        if (isNaN(parsedChips) || parsedChips < 0) {
            return res.status(400).json({ error: '筹码数量必须为非负整数' });
        }

        // #16 防止重复结账
        const { data: existingCheckout } = await supabase
            .from('buy_ins')
            .select('id')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .eq('type', 'checkout')
            .limit(1);

        if (existingCheckout && existingCheckout.length > 0) {
            return res.status(400).json({ error: '您已经结过账了，不能重复结账' });
        }

        const { data, error } = await supabase
            .from('buy_ins')
            .insert({
                game_id: gameId,
                user_id: userId,
                amount: parsedChips,
                type: 'checkout',
            })
            .select(`*, users(id, username)`)
            .single();

        if (error) {
            console.error('[buyin/checkout]', error);
            return res.status(500).json({ error: '结账记录提交失败' });
        }

        return res.status(201).json({ checkout: data });
    } catch (err: unknown) {
        console.error('[buyin/checkout] Unhandled error:', err);
        const message = err instanceof Error ? err.message : '结算时发生错误';
        return res.status(500).json({ error: message });
    }
});

export default router;
