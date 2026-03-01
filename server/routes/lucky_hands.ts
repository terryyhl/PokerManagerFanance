import { Router } from 'express';
import { supabase } from '../supabase.js';

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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '获取幸运手牌数据失败';
        console.error('[lucky_hands/get]', err);
        return res.status(500).json({ error: message });
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

        const parsedHandIndex = parseInt(handIndex, 10);
        if (isNaN(parsedHandIndex) || parsedHandIndex < 1 || parsedHandIndex > 3) {
            return res.status(400).json({ error: '无效的槽位编号' });
        }

        if (typeof card1 !== 'string' || typeof card2 !== 'string' || !card1.trim() || !card2.trim()) {
            return res.status(400).json({ error: '无效的卡牌' });
        }

        const game = await getGameLuckyHandsConfig(gameId);
        if (game.status !== 'active') return res.status(400).json({ error: '游戏非活跃状态' });
        if (parsedHandIndex > game.lucky_hands_count) {
            return res.status(400).json({ error: '槽位不被房间配置允许' });
        }

        // Upsert 写入对应用户+槽位配置并重置中奖次数
        const { data, error } = await supabase
            .from('lucky_hands')
            .upsert({
                game_id: gameId,
                user_id: userId,
                hand_index: parsedHandIndex,
                card_1: card1.trim(),
                card_2: card2.trim(),
                hit_count: 0,
            }, { onConflict: 'game_id,user_id,hand_index' })
            .select(`*, users(id, username)`)
            .single();

        if (error) throw error;

        return res.json({ success: true, luckyHand: data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '配置手牌失败';
        console.error('[lucky_hands/setup]', err);
        return res.status(500).json({ error: message });
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
    } catch (err: unknown) {
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
                request_type: 'hit',
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({ success: true, pendingHit: data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '提交中奖审核失败';
        console.error('[lucky_hands/hit-submit]', err);
        return res.status(500).json({ error: message });
    }
});

/**
 * POST /api/lucky-hands/:gameId/update-submit
 * 玩家发起手牌修改的人工审核申请
 */
router.post('/:gameId/update-submit', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, luckyHandId, newCard1, newCard2 } = req.body;

        if (!userId || !luckyHandId || !newCard1 || !newCard2) return res.status(400).json({ error: '参数缺失' });

        const { data, error } = await supabase
            .from('pending_lucky_hits')
            .insert({
                game_id: gameId,
                user_id: userId,
                lucky_hand_id: luckyHandId,
                request_type: 'update',
                new_card_1: newCard1,
                new_card_2: newCard2,
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({ success: true, pendingUpdate: data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '提交修改审核失败';
        console.error('[lucky_hands/update-submit]', err);
        return res.status(500).json({ error: message });
    }
});

/**
 * POST /api/lucky-hands/:gameId/hit-direct
 * 房主直接点选自己的幸运手牌直接过审增加次数（不需要走 pending 库）
 * 使用原子操作 rpc 增加 hit_count，避免竞态条件
 */
router.post('/:gameId/hit-direct', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId, luckyHandId } = req.body;

        if (!userId || !luckyHandId) return res.status(400).json({ error: '参数缺失' });

        // 验证该用户是否确实是房主
        const game = await getGameLuckyHandsConfig(gameId);
        if (game.created_by !== userId) {
            return res.status(403).json({ error: '只有房主本体才能使用直接过审接口' });
        }

        // 原子自增 hit_count，避免竞态条件
        const { data: updatedHand, error: updateError } = await supabase
            .rpc('increment_hit_count', { hand_id: luckyHandId });

        if (updateError) throw updateError;

        const newCount = updatedHand;

        return res.json({ success: true, newCount });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '房主直接增加手牌记录失败';
        console.error('[lucky_hands/hit-direct]', err);
        return res.status(500).json({ error: message });
    }
});


/**
 * POST /api/lucky-hands/:gameId/hit-approve/:hitId
 * 房主批准某中奖申请或改牌申请：根据 request_type 处理业务，完成后删除申请
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

        // 2. 获取手牌信息用于更新或加减
        const { data: luckyHand, error: handError } = await supabase
            .from('lucky_hands')
            .select('hit_count, card_1, card_2, hand_index')
            .eq('id', hit.lucky_hand_id)
            .single();

        if (handError || !luckyHand) return res.status(500).json({ error: '关联的手牌记录不存在' });

        const reqType = hit.request_type || 'hit';
        let newCount: number;

        // 3. 执行核心业务逻辑
        if (reqType === 'update') {
            const { error: updateCardErr } = await supabase
                .from('lucky_hands')
                .update({
                    card_1: hit.new_card_1,
                    card_2: hit.new_card_2,
                    hit_count: 0 // 改牌时重置计数
                })
                .eq('id', hit.lucky_hand_id);
            if (updateCardErr) throw updateCardErr;
            newCount = 0;
        } else {
            // 原子自增 hit_count，避免竞态条件
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('increment_hit_count', { hand_id: hit.lucky_hand_id });

            if (rpcError) throw rpcError;
            newCount = rpcResult;
        }

        // 4. 删除完毕
        await supabase.from('pending_lucky_hits').delete().eq('id', hitId);

        return res.json({ success: true, newCount });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '审批处理失败';
        console.error('[lucky_hands/approve]', err);
        return res.status(500).json({ error: message });
    }
});


/**
 * POST /api/lucky-hands/:gameId/hit-reject/:hitId
 * 房主拒绝某中奖申请：直接删除该申请
 */
router.post('/:gameId/hit-reject/:hitId', async (req, res) => {
    try {
        const { hitId } = req.params;

        const { data: hit, error: hitError } = await supabase
            .from('pending_lucky_hits')
            .select('*')
            .eq('id', hitId)
            .single();

        if (hitError) return res.status(404).json({ error: '申请不存在' });

        await supabase.from('pending_lucky_hits').delete().eq('id', hitId);

        return res.json({ success: true });
    } catch (err: unknown) {
        console.error('[lucky_hands/reject]', err);
        return res.status(500).json({ error: '拒绝申请失败' });
    }
});

export default router;
