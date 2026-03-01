import { Router } from 'express';
import { supabase } from '../supabase.js';
import { broadcastToGame, notifyUser } from '../sse.js';

const router = Router();

/**
 * 内部辅助函数：获取单个游戏配置，检查 lucky_hands_count
 */
async function getGameLuckyHandsConfig(gameId: string) {
    const { data: game, error } = await supabase
        .from('games')
        .select('lucky_hands_count, created_by, status')
        .eq('id', gameId)
        .single();
    if (error || !game) throw new Error('获取房间信息失败');
    return game;
}

/**
 * GET /api/lucky-hands/:gameId
 * 获取该房间的所有幸运手牌配置及中奖数据
 */
router.get('/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { data, error } = await supabase
            .from('lucky_hands')
            .select(`
                *,
                users (id, username)
            `)
            .eq('game_id', gameId);

        if (error) throw error;
        return res.json({ luckyHands: data || [] });
    } catch (err: any) {
        console.error('[lucky_hands/get]', err);
        return res.status(500).json({ error: err.message || '获取幸运手牌数据失败' });
    }
});

/**
 * POST /api/lucky-hands/:gameId/setup
 * 用户配置某个槽位 (1/2/3) 的手牌卡牌面
 */
router.post('/:gameId/setup', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, handIndex, card1, card2 } = req.body;

        if (!userId || !handIndex || !card1 || !card2) {
            return res.status(400).json({ error: '参数缺失' });
        }

        const game = await getGameLuckyHandsConfig(gameId);
        if (game.status !== 'active') return res.status(400).json({ error: '游戏非活跃状态' });
        if (handIndex < 1 || handIndex > game.lucky_hands_count) {
            return res.status(400).json({ error: '槽位不被房间配置允许' });
        }

        // Upsert 写入对应用户+槽位配置
        const { data, error } = await supabase
            .from('lucky_hands')
            .upsert({
                game_id: gameId,
                user_id: userId,
                hand_index: handIndex,
                card_1: card1,
                card_2: card2,
            }, { onConflict: 'game_id,user_id,hand_index' })
            .select(`*, users(id, username)`)
            .single();

        if (error) throw error;

        // 通知所有人已更新配置信息
        broadcastToGame(gameId, 'game_refresh', { type: 'lucky_hand_setup', userId });

        return res.json({ success: true, luckyHand: data });
    } catch (err: any) {
        console.error('[lucky_hands/setup]', err);
        return res.status(500).json({ error: err.message || '配置手牌失败' });
    }
});


/**
 * GET /api/lucky-hands/:gameId/pending
 * [房主] 获取游戏中所有待审核的中奖申请
 */
router.get('/:gameId/pending', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { data, error } = await supabase
            .from('pending_lucky_hits')
            .select(`
                *,
                users (id, username),
                lucky_hands (card_1, card_2, hand_index)
            `)
            .eq('game_id', gameId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.json({ pendingHits: data || [] });
    } catch (err: any) {
        console.error('[lucky_hands/pending]', err);
        return res.status(500).json({ error: '获取待审核列表失败' });
    }
});


/**
 * POST /api/lucky-hands/:gameId/hit-submit
 * 玩家发起对应配置手牌槽位的中奖人工审核申请
 */
router.post('/:gameId/hit-submit', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, luckyHandId } = req.body;

        if (!userId || !luckyHandId) return res.status(400).json({ error: '参数缺失' });

        const { data, error } = await supabase
            .from('pending_lucky_hits')
            .insert({
                game_id: gameId,
                user_id: userId,
                lucky_hand_id: luckyHandId,
            })
            .select()
            .single();

        if (error) throw error;

        // 不需要全员通知，只需要通知房主即可。由于前端也将读取 supabase_realtime，这里仅做备用
        // 但安全起见我们不抛出错误，房主将收到 webhook

        return res.json({ success: true, pendingHit: data });
    } catch (err: any) {
        console.error('[lucky_hands/hit-submit]', err);
        return res.status(500).json({ error: err.message || '提交中奖审核失败' });
    }
});


/**
 * POST /api/lucky-hands/:gameId/hit-approve/:hitId
 * 房主批准某中奖申请：相关手牌 hit_count+1，删除该申请
 */
router.post('/:gameId/hit-approve/:hitId', async (req, res) => {
    try {
        const { gameId, hitId } = req.params;

        // 1. 获取申请
        const { data: hit, error: hitError } = await supabase
            .from('pending_lucky_hits')
            .select('*')
            .eq('id', hitId)
            .single();
        if (hitError || !hit) return res.status(404).json({ error: '审核申请不存在' });

        // 2. 利用 RPC 或多次请求增加 hit_count (我们没有 RPC，用查询+覆盖由于并发可能问题，先妥协用最少代码查询再 update)
        const { data: luckyHand, error: handError } = await supabase
            .from('lucky_hands')
            .select('hit_count, card_1, card_2, hand_index')
            .eq('id', hit.lucky_hand_id)
            .single();

        if (handError || !luckyHand) return res.status(500).json({ error: '关联的手牌记录不存在' });

        const { error: updateError } = await supabase
            .from('lucky_hands')
            .update({ hit_count: luckyHand.hit_count + 1 })
            .eq('id', hit.lucky_hand_id);

        if (updateError) throw updateError;

        // 3. 删除
        await supabase.from('pending_lucky_hits').delete().eq('id', hitId);

        // 4. 通知
        broadcastToGame(gameId, 'game_refresh', { type: 'lucky_hit_approved', userId: hit.user_id });
        notifyUser(gameId, hit.user_id, 'lucky_hit_approved', {
            handIndex: luckyHand.hand_index,
            cards: `${luckyHand.card_1}, ${luckyHand.card_2}`,
            newCount: luckyHand.hit_count + 1
        });

        return res.json({ success: true, newCount: luckyHand.hit_count + 1 });
    } catch (err: any) {
        console.error('[lucky_hands/approve]', err);
        return res.status(500).json({ error: err.message || '审批处理失败' });
    }
});


/**
 * POST /api/lucky-hands/:gameId/hit-reject/:hitId
 * 房主拒绝某中奖申请：直接删除该申请
 */
router.post('/:gameId/hit-reject/:hitId', async (req, res) => {
    try {
        const { gameId, hitId } = req.params;

        const { data: hit, error: hitError } = await supabase
            .from('pending_lucky_hits')
            .select('*')
            .eq('id', hitId)
            .single();

        if (hitError) return res.status(404).json({ error: '申请不存在' });

        await supabase.from('pending_lucky_hits').delete().eq('id', hitId);

        notifyUser(gameId, hit.user_id, 'lucky_hit_rejected', {});

        return res.json({ success: true });
    } catch (err: any) {
        console.error('[lucky_hands/reject]', err);
        return res.status(500).json({ error: '拒绝申请失败' });
    }
});

export default router;
