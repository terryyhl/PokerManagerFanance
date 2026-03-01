import { Router } from 'express';
import { supabase } from '../supabase.js';

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
});

/**
 * GET /api/games/history?userId=xxx
 * 获取当前用户参与过的所有已完成历史牌局
 */
router.get('/history', async (req, res) => {
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

    const gameIds = (playerRecords || []).map((r: any) => r.game_id);

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
});



/**
 * GET /api/games/:id
 * 获取单个游戏详情（含玩家列表、买入记录）
 */
router.get('/:id', async (req, res) => {
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
});

/**
 * POST /api/games
 * 创建新游戏
 */
router.post('/', async (req, res) => {
    const { name, blindLevel, minBuyin, maxBuyin, insuranceMode, luckyHandsCount, userId } = req.body;

    if (!name || !userId) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    // 生成唯一房间码
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
        const { data: existing } = await supabase
            .from('games')
            .select('id')
            .eq('room_code', roomCode)
            .single();
        if (!existing) break;
        roomCode = generateRoomCode();
        attempts++;
    }

    const { data, error } = await supabase
        .from('games')
        .insert({
            name,
            blind_level: blindLevel || '1/2',
            min_buyin: minBuyin || 100,
            max_buyin: maxBuyin || 400,
            insurance_mode: insuranceMode || false,
            lucky_hands_count: luckyHandsCount || 0,
            room_code: roomCode,
            status: 'active',
            created_by: userId,
        })
        .select()
        .single();

    if (error) {
        console.error('[games/create]', error);
        return res.status(500).json({ error: '创建游戏失败' });
    }

    // 创建者自动加入游戏
    await supabase
        .from('game_players')
        .insert({ game_id: data.id, user_id: userId });

    // 广播通知大厅所有用户，有新游戏创建了
    import('../sse.js').then((sse) => {
        sse.broadcastToLobby('lobby_refresh', { gameId: data.id });
    });

    return res.status(201).json({ game: data });
});

/**
 * POST /api/games/join
 * 通过房间码加入游戏
 */
router.post('/join', async (req, res) => {
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

    // 加入游戏（如果已加入则忽略）
    await supabase
        .from('game_players')
        .upsert({ game_id: game.id, user_id: userId }, { onConflict: 'game_id,user_id' });

    // 广播通知房间内所有人，有新玩家加入
    import('../sse.js').then((sse) => {
        sse.broadcastToGame(game.id, 'game_refresh', { type: 'player_join', userId });
    });

    return res.json({ game });
});

/**
 * POST /api/games/:id/finish
 * 结束游戏
 */
router.post('/:id/finish', async (req, res) => {
    const { id } = req.params;

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
});

export default router;
