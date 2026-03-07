import { Router } from 'express';
import { supabase } from '../supabase.js';
import { getPending } from '../pendingRequests.js';

const router = Router();

/** 生成6位随机数字房间码 */
function generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * GET /api/games
 * 获取所有活跃游戏列表（含玩家数量）
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('games')
            .select(`
      *,
      game_players(count),
      users!games_created_by_fkey(username)
    `)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[games/list]', error);
            return res.status(500).json({ error: '获取游戏列表失败' });
        }

        return res.json({ games: data });
    } catch (err) {
        console.error('[games/list] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/games/history?userId=xxx
 * 获取当前用户参与过的所有已完成历史牌局
 */
router.get('/history', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: '缺少 userId 参数' });
        }

        // 先找出该用户参与过的所有 game_id
        const { data: playerRecords, error: playerError } = await supabase
            .from('game_players')
            .select('game_id')
            .eq('user_id', userId);

        if (playerError) {
            console.error('[games/history players]', playerError);
            return res.status(500).json({ error: '获取历史牌局失败' });
        }

        const gameIds = (playerRecords || []).map((r) => r.game_id);

        if (gameIds.length === 0) {
            return res.json({ games: [] });
        }

        // 再查这些 game_id 中已完成的游戏
        const { data, error } = await supabase
            .from('games')
            .select(`
      *,
      game_players(count),
      users!games_created_by_fkey(username)
    `)
            .in('id', gameIds)
            .eq('status', 'finished')
            .order('finished_at', { ascending: false });

        if (error) {
            console.error('[games/history]', error);
            return res.status(500).json({ error: '获取历史牌局失败' });
        }

        return res.json({ games: data });
    } catch (err) {
        console.error('[games/history] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});



/**
 * GET /api/games/:id/full-state?userId=xxx
 * 一次性返回房间全量状态：game + buyIns + players + pendingRequests + luckyHands + pendingLuckyHits
 * pendingRequests / pendingLuckyHits 仅在请求者是房主时返回有效数据
 */
router.get('/:id/full-state', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId as string | undefined;

        // 并行查询所有数据
        const [gameResult, buyInsResult, playersResult, pendingResult] = await Promise.all([
            supabase.from('games').select('*, users!games_created_by_fkey(id, username)').eq('id', id).single(),
            supabase.from('buy_ins').select('*, users!user_id(id, username)').eq('game_id', id).order('created_at', { ascending: true }),
            supabase.from('game_players').select('*, users(id, username)').eq('game_id', id),
            getPending(id),
        ]);

        if (gameResult.error || !gameResult.data) {
            return res.status(404).json({ error: '游戏不存在' });
        }

        const game = gameResult.data;
        const isHost = userId && game.created_by === userId;

        // 幸运手牌相关查询（条件查询，仅在开启时执行）
        let luckyHands: unknown[] = [];
        let pendingLuckyHits: unknown[] = [];

        if (game.lucky_hands_count > 0) {
            const [lhResult, plhResult] = await Promise.all([
                supabase.from('lucky_hands').select('*, users(id, username)').eq('game_id', id),
                isHost
                    ? supabase.from('pending_lucky_hits').select('*, users(id, username), lucky_hands(card_1, card_2, hand_index)').eq('game_id', id).order('created_at', { ascending: true })
                    : Promise.resolve({ data: [], error: null }),
            ]);
            luckyHands = lhResult.data || [];
            pendingLuckyHits = plhResult.data || [];
        }

        // 房主: 返回全部 pending；普通用户: 仅返回自己的 pending
        const filteredPending = isHost
            ? pendingResult
            : userId
                ? pendingResult.filter(r => r.userId === userId)
                : [];

        return res.json({
            game,
            buyIns: buyInsResult.data || [],
            players: playersResult.data || [],
            pendingRequests: filteredPending,
            luckyHands,
            pendingLuckyHits,
        });
    } catch (err) {
        console.error('[games/full-state] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/games/:id
 * 获取单个游戏详情（含玩家列表、买入记录）
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: game, error: gameError } = await supabase
            .from('games')
            .select(`
      *,
      users!games_created_by_fkey(id, username)
    `)
            .eq('id', id)
            .single();

        if (gameError || !game) {
            return res.status(404).json({ error: '游戏不存在' });
        }

        // 获取买入记录（非结账类型）
        const { data: buyIns, error: buyInError } = await supabase
            .from('buy_ins')
            .select(`
      *,
      users(id, username)
    `)
            .eq('game_id', id)
            .order('created_at', { ascending: true });

        if (buyInError) {
            console.error('[games/get buyins]', buyInError);
        }

        // 获取玩家列表
        const { data: players, error: playersError } = await supabase
            .from('game_players')
            .select(`
      *,
      users(id, username)
    `)
            .eq('game_id', id);

        if (playersError) {
            console.error('[games/get players]', playersError);
        }

        return res.json({
            game,
            buyIns: buyIns || [],
            players: players || [],
        });
    } catch (err) {
        console.error('[games/get] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * POST /api/games
 * 创建新游戏
 */
router.post('/', async (req, res) => {
    try {
        const {
            name, userId, roomType,
            // 德州配置
            blindLevel, minBuyin, maxBuyin, insuranceMode, luckyHandsCount,
            // 13水配置
            thirteenBaseScore, thirteenGhostCount, thirteenCompareSuit,
            thirteenMaxPlayers, thirteenTimeLimit,
        } = req.body;

        if (!name || !userId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        if (typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: '房间名称不能为空' });
        }

        const type = roomType === 'thirteen' ? 'thirteen' : 'texas';

        // 生成唯一房间码：利用数据库唯一约束 + 重试机制
        let data = null;
        let lastError = null;
        const MAX_ATTEMPTS = 10;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const roomCode = generateRoomCode();

            const insertPayload: Record<string, unknown> = {
                name: name.trim(),
                room_type: type,
                room_code: roomCode,
                status: 'active',
                created_by: userId,
                // 德州字段（13水房间也保留默认值，不影响）
                blind_level: blindLevel || '1/2',
                min_buyin: minBuyin || 100,
                max_buyin: maxBuyin || 400,
                insurance_mode: insuranceMode || false,
                lucky_hands_count: luckyHandsCount || 0,
            };

            // 13水专属配置
            if (type === 'thirteen') {
                insertPayload.thirteen_base_score = thirteenBaseScore || 1;
                insertPayload.thirteen_ghost_count = [0, 2, 4, 6].includes(thirteenGhostCount) ? thirteenGhostCount : 6;
                insertPayload.thirteen_compare_suit = thirteenCompareSuit !== false;
                insertPayload.thirteen_max_players = Math.min(4, Math.max(2, thirteenMaxPlayers || 4));
                insertPayload.thirteen_time_limit = thirteenTimeLimit || 90;
            }

            let insertedGame = null;
            let insertError = null;

            // 尝试插入（含13水字段）
            const result1 = await supabase
                .from('games')
                .insert(insertPayload)
                .select()
                .single();

            insertedGame = result1.data;
            insertError = result1.error;

            // 如果 room_type 列不存在（数据库尚未迁移），降级为仅德州字段
            if (insertError && insertError.code === 'PGRST204' && insertError.message?.includes('room_type')) {
                console.warn('[games/create] room_type 列不存在，降级为德州模式插入');
                const fallbackPayload: Record<string, unknown> = {
                    name: name.trim(),
                    room_code: roomCode,
                    status: 'active',
                    created_by: userId,
                    blind_level: blindLevel || '1/2',
                    min_buyin: minBuyin || 100,
                    max_buyin: maxBuyin || 400,
                    insurance_mode: insuranceMode || false,
                    lucky_hands_count: luckyHandsCount || 0,
                };
                const result2 = await supabase
                    .from('games')
                    .insert(fallbackPayload)
                    .select()
                    .single();

                insertedGame = result2.data;
                insertError = result2.error;
            }

            if (!insertError && insertedGame) {
                data = insertedGame;
                break;
            }

            // 如果是唯一约束冲突（room_code 重复），重试
            if (insertError?.code === '23505' && insertError.message?.includes('room_code')) {
                lastError = insertError;
                continue;
            }

            // 其他错误直接返回
            console.error('[games/create]', insertError);
            return res.status(500).json({ error: '创建游戏失败' });
        }

        if (!data) {
            console.error('[games/create] 无法生成唯一房间码，已尝试', MAX_ATTEMPTS, '次', lastError);
            return res.status(500).json({ error: '创建游戏失败：无法生成唯一房间码，请重试' });
        }

        // 创建者自动加入游戏
        const { error: joinError } = await supabase
            .from('game_players')
            .insert({ game_id: data.id, user_id: userId });

        if (joinError) {
            console.error('[games/create] 房主自动加入失败:', joinError);
            // 回滚：删除刚创建的游戏
            await supabase.from('games').delete().eq('id', data.id);
            return res.status(500).json({ error: '创建游戏失败：房主加入房间失败' });
        }

        return res.status(201).json({ game: data });
    } catch (err) {
        console.error('[games/create] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * POST /api/games/join
 * 通过房间码加入游戏
 */
router.post('/join', async (req, res) => {
    try {
        const { roomCode, userId } = req.body;

        if (!roomCode || !userId) {
            return res.status(400).json({ error: '缺少房间码或用户信息' });
        }

        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('room_code', roomCode.toString())
            .eq('status', 'active')
            .single();

        if (gameError || !game) {
            return res.status(404).json({ error: '房间不存在或已结束' });
        }

        // 13水房间检查最大人数限制
        if (game.room_type === 'thirteen') {
            const maxPlayers = game.thirteen_max_players || 4;
            const { count, error: countErr } = await supabase
                .from('game_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id);

            if (!countErr && count !== null && count >= maxPlayers) {
                // 检查是否已在房间内（允许重复加入）
                const { data: existing } = await supabase
                    .from('game_players')
                    .select('id')
                    .eq('game_id', game.id)
                    .eq('user_id', userId)
                    .single();
                if (!existing) {
                    return res.status(400).json({ error: `房间已满（最多${maxPlayers}人）` });
                }
            }
        }

        // 加入游戏（如果已加入则忽略）
        const { error: upsertError } = await supabase
            .from('game_players')
            .upsert({ game_id: game.id, user_id: userId }, { onConflict: 'game_id,user_id' });

        if (upsertError) {
            console.error('[games/join] 加入游戏失败:', upsertError);
            return res.status(500).json({ error: '加入游戏失败' });
        }

        return res.json({ game });
    } catch (err) {
        console.error('[games/join] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * POST /api/games/:id/finish
 * 结束游戏（仅房主可操作）
 */
router.post('/:id/finish', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: '未授权的请求' });
        }

        // 验证是否为房主
        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('created_by')
            .eq('id', id)
            .single();

        if (gameError || !game) {
            return res.status(404).json({ error: '游戏不存在' });
        }

        if (game.created_by !== userId) {
            return res.status(403).json({ error: '只有房主才能结束游戏' });
        }

        const { data, error } = await supabase
            .from('games')
            .update({ status: 'finished', finished_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[games/finish]', error);
            return res.status(500).json({ error: '结束游戏失败' });
        }

        return res.json({ game: data });
    } catch (err) {
        console.error('[games/finish] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
