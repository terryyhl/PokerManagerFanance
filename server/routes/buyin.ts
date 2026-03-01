import { Router } from 'express';
import { supabase } from '../supabase.js';
import { broadcastToGame, notifyHost, notifyUser } from '../sse.js';
import { addPending, removePending, getPending } from '../pendingRequests.js';

const router = Router();

/**
 * POST /api/buyin
 * 直接买入（非审核模式 or 房主）
 * 成功后广播 game_refresh 给所有房间用户
 */
router.post('/', async (req, res) => {
    const { gameId, userId, amount, type } = req.body;

    if (!gameId || !userId || !amount) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    const validType = type === 'rebuy' ? 'rebuy' : 'initial';

    const { data, error } = await supabase
        .from('buy_ins')
        .insert({
            game_id: gameId,
            user_id: userId,
            amount: parseInt(amount, 10),
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

    // 广播刷新事件给所有房间用户
    broadcastToGame(gameId, 'game_refresh', { type: 'buyin', userId });

    return res.status(201).json({ buyIn: data });
});

/**
 * POST /api/buyin/pending
 * 提交待审核买入申请（带入审核模式下，非房主用户使用）
 * 成功后 SSE 通知房主
 */
router.post('/pending', async (req, res) => {
    const { gameId, userId, username, amount, type } = req.body;

    if (!gameId || !userId || !username || !amount) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    const pending = await addPending({
        gameId,
        userId,
        username,
        amount: parseInt(amount, 10),
        type: type === 'rebuy' ? 'rebuy' : 'initial',
    });

    // SSE 通知房主有新的待审核申请
    notifyHost(gameId, 'buyin_request', pending);

    return res.status(201).json({ request: pending });
});

/**
 * GET /api/buyin/pending/:gameId
 * 获取当前游戏所有待审核申请（房主使用）
 */
router.get('/pending/:gameId', async (req, res) => {
    const { gameId } = req.params;
    const requests = await getPending(gameId);
    return res.json({ requests });
});

/**
 * POST /api/buyin/pending/:id/approve
 * 房主批准买入申请：写入 DB + 广播刷新 + 通知申请用户
 */
router.post('/pending/:id/approve', async (req, res) => {
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

    // 广播给所有人刷新
    broadcastToGame(pending.gameId, 'game_refresh', { type: 'buyin_approved', userId: pending.userId });

    // 额外通知申请人：你的买入申请已通过
    notifyUser(pending.gameId, pending.userId, 'buyin_approved', { amount: pending.amount, type: pending.type });

    return res.status(201).json({ buyIn: data });
});

/**
 * DELETE /api/buyin/pending/:id
 * 房主拒绝买入申请
 */
router.delete('/pending/:id', async (req, res) => {
    const { id } = req.params;

    const pending = await removePending(id);
    if (!pending) {
        return res.status(404).json({ error: '申请不存在或已处理' });
    }

    // 通知申请人：申请被拒绝
    notifyUser(pending.gameId, pending.userId, 'buyin_rejected', {
        amount: pending.amount,
        type: pending.type,
        requestId: id,
    });

    return res.json({ success: true });
});

/**
 * POST /api/buyin/checkout
 * 结账：广播刷新
 */
router.post('/checkout', async (req, res) => {
    const { gameId, userId, chips } = req.body;

    if (!gameId || !userId || chips === undefined) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    const { data, error } = await supabase
        .from('buy_ins')
        .insert({
            game_id: gameId,
            user_id: userId,
            amount: parseInt(chips, 10),
            type: 'checkout',
        })
        .select(`*, users(id, username)`)
        .single();

    if (error) {
        console.error('[buyin/checkout]', error);
        return res.status(500).json({ error: '结账记录提交失败' });
    }

    broadcastToGame(gameId, 'game_refresh', { type: 'checkout', userId });

    return res.status(201).json({ checkout: data });
});

export default router;
