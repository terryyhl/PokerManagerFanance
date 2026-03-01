import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

/**
 * POST /api/users/login
 * 输入 username，upsert 用户（无密码），返回用户对象
 */
router.post('/login', async (req, res) => {
    const { username } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: '昵称不能为空' });
    }

    const trimmed = username.trim();

    // Upsert: 如果用户已存在则返回现有记录，否则创建
    const { data, error } = await supabase
        .from('users')
        .upsert({ username: trimmed }, { onConflict: 'username' })
        .select()
        .single();

    if (error) {
        console.error('[users/login]', error);
        return res.status(500).json({ error: '登录失败，请重试' });
    }

    return res.json({ user: data });
});

/**
 * GET /api/users/:id/stats
 * 获取指定用户的历史对局统计数据
 */
router.get('/:id/stats', async (req, res) => {
    const { id } = req.params;

    // 获取该用户所有结算记录，并 join games 表获取游戏详情
    const { data: settlements, error } = await supabase
        .from('settlements')
        .select(`
            *,
            games (
                id,
                name,
                blind_level,
                status,
                created_at,
                finished_at
            )
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[users/stats]', error);
        return res.status(500).json({ error: '获取统计数据失败' });
    }

    if (!settlements || settlements.length === 0) {
        return res.json({
            stats: { totalGames: 0, totalProfit: 0, totalBuyIn: 0, winRate: 0 },
            history: []
        });
    }

    let totalProfit = 0;
    let totalBuyIn = 0;
    let winCount = 0;

    const history = settlements.map(s => {
        const profit = s.net_profit || 0;
        const buyin = s.total_buyin || 0;

        totalProfit += profit;
        totalBuyIn += buyin;
        if (profit > 0) winCount++;

        return {
            gameId: s.game_id,
            gameName: s.games?.name || '未知房间',
            blindLevel: s.games?.blind_level || '?',
            finishedAt: s.games?.finished_at || s.created_at,
            profit,
            finalChips: s.final_chips || 0,
            totalBuyIn: buyin
        };
    });

    const totalGames = settlements.length;
    const winRate = totalGames > 0 ? Math.round((winCount / totalGames) * 100) : 0;

    return res.json({
        stats: {
            totalGames,
            totalProfit,
            totalBuyIn,
            winRate
        },
        history
    });
});

export default router;
