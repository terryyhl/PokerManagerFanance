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
        const { gameId, userId, handCount, type, createdBy } = req.body;

        if (!gameId || !userId || !handCount) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 输入验证：手数必须为正整数
        const parsedHandCount = parseInt(handCount, 10);
        if (isNaN(parsedHandCount) || parsedHandCount <= 0) {
            return res.status(400).json({ error: '手数必须为正整数' });
        }

        // 查询房间配置获取 points_per_hand 和 max_hands_per_buy
        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('created_by, points_per_hand, max_hands_per_buy')
            .eq('id', gameId)
            .single();

        if (gameError || !game) {
            return res.status(404).json({ error: '房间不存在' });
        }

        // 校验手数上限
        const maxHands = game.max_hands_per_buy || 10;
        if (parsedHandCount > maxHands) {
            return res.status(400).json({ error: `单次最多买入 ${maxHands} 手` });
        }

        // 后端计算金额
        const pph = game.points_per_hand || 100;
        const parsedAmount = parsedHandCount * pph;

        // 房主代操作校验：如果 createdBy 存在且不等于 userId，验证 createdBy 是否为房主
        if (createdBy && createdBy !== userId) {
            if (game.created_by !== createdBy) {
                return res.status(403).json({ error: '只有房主才能代操作' });
            }
        }

        const validType = type === 'rebuy' ? 'rebuy' : 'initial';

        // created_by: 仅在代操作时记录操作人，本人操作为 null
        const isProxy = createdBy && createdBy !== userId;

        const { data, error } = await supabase
            .from('buy_ins')
            .insert({
                game_id: gameId,
                user_id: userId,
                amount: parsedAmount,
                type: validType,
                hand_count: parsedHandCount,
                points_per_hand: pph,
                ...(isProxy ? { created_by: createdBy } : {}),
            })
            .select(`*, users!user_id(id, username)`)
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
            .select('amount, type, created_by, created_at')
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
        const { gameId, userId, username, handCount, type } = req.body;

        if (!gameId || !userId || !username || !handCount) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // 输入验证：手数必须为正整数
        const parsedHandCount = parseInt(handCount, 10);
        if (isNaN(parsedHandCount) || parsedHandCount <= 0) {
            return res.status(400).json({ error: '手数必须为正整数' });
        }

        // 查询房间配置
        const { data: game } = await supabase
            .from('games')
            .select('points_per_hand, max_hands_per_buy')
            .eq('id', gameId)
            .single();

        const pph = game?.points_per_hand || 100;
        const maxHands = game?.max_hands_per_buy || 10;

        if (parsedHandCount > maxHands) {
            return res.status(400).json({ error: `单次最多买入 ${maxHands} 手` });
        }

        const parsedAmount = parsedHandCount * pph;

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
            handCount: parsedHandCount,
            pointsPerHand: pph,
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
                ...(pending.handCount ? { hand_count: pending.handCount } : {}),
                ...(pending.pointsPerHand ? { points_per_hand: pending.pointsPerHand } : {}),
            })
            .select(`*, users!user_id(id, username)`)
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
        const { gameId, userId, chips, createdBy } = req.body;

        if (!gameId || !userId || chips === undefined) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        // #15 输入验证
        const parsedChips = parseInt(chips, 10);
        if (isNaN(parsedChips) || parsedChips < 0) {
            return res.status(400).json({ error: '筹码数量必须为非负整数' });
        }

        // 房主代操作校验
        if (createdBy && createdBy !== userId) {
            const { data: game } = await supabase
                .from('games')
                .select('created_by')
                .eq('id', gameId)
                .single();
            if (!game || game.created_by !== createdBy) {
                return res.status(403).json({ error: '只有房主才能代操作' });
            }
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

        const isProxy = createdBy && createdBy !== userId;

        const { data, error } = await supabase
            .from('buy_ins')
            .insert({
                game_id: gameId,
                user_id: userId,
                amount: parsedChips,
                type: 'checkout',
                ...(isProxy ? { created_by: createdBy } : {}),
            })
            .select(`*, users!user_id(id, username)`)
            .single();

        if (error) {
            console.error('[buyin/checkout]', error);
            return res.status(500).json({ error: '结账记录提交失败' });
        }

        // ── 检查是否所有有买入的玩家都已结账，若是则自动结算关闭房间 ──
        try {
            // 获取所有买入记录（含刚插入的这条 checkout）
            const { data: allBuyIns } = await supabase
                .from('buy_ins')
                .select('user_id, type, amount')
                .eq('game_id', gameId);

            // 有买入记录的玩家
            const playersWithBuyIn = new Set(
                (allBuyIns || [])
                    .filter(b => b.type === 'initial' || b.type === 'rebuy')
                    .map(b => b.user_id)
            );

            // 已结账的玩家
            const playersWithCheckout = new Set(
                (allBuyIns || [])
                    .filter(b => b.type === 'checkout')
                    .map(b => b.user_id)
            );

            // 所有有买入的玩家都已结账 → 自动结算关闭房间
            const allCheckedOut = playersWithBuyIn.size > 0 &&
                [...playersWithBuyIn].every(uid => playersWithCheckout.has(uid));

            if (allCheckedOut) {
                // 计算每位玩家的总买入和最终筹码
                const buyInByUser: Record<string, number> = {};
                const chipsByUser: Record<string, number> = {};

                (allBuyIns || []).forEach(b => {
                    if (b.type === 'initial' || b.type === 'rebuy') {
                        buyInByUser[b.user_id] = (buyInByUser[b.user_id] || 0) + b.amount;
                    } else if (b.type === 'checkout') {
                        chipsByUser[b.user_id] = b.amount; // 取最后一条（已防重复）
                    }
                });

                const settlementsToInsert = [...playersWithBuyIn].map(uid => ({
                    game_id: gameId,
                    user_id: uid,
                    final_chips: chipsByUser[uid] || 0,
                    total_buyin: buyInByUser[uid] || 0,
                    net_profit: (chipsByUser[uid] || 0) - (buyInByUser[uid] || 0),
                }));

                await supabase
                    .from('settlements')
                    .upsert(settlementsToInsert, { onConflict: 'game_id,user_id' });

                await supabase
                    .from('games')
                    .update({ status: 'finished', finished_at: new Date().toISOString() })
                    .eq('id', gameId);

                console.log(`[buyin/checkout] 所有玩家已结账，自动关闭房间 ${gameId}`);
                return res.status(201).json({ checkout: data, autoSettled: true });
            }
        } catch (autoErr) {
            // 自动结算失败不影响结账本身的成功
            console.error('[buyin/checkout] 自动结算检查失败:', autoErr);
        }

        return res.status(201).json({ checkout: data });
    } catch (err: unknown) {
        console.error('[buyin/checkout] Unhandled error:', err);
        const message = err instanceof Error ? err.message : '结算时发生错误';
        return res.status(500).json({ error: message });
    }
});

export default router;
