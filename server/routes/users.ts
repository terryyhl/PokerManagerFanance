import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

/**
 * POST /api/users/login
 * 输入 username，upsert 用户（无密码），返回用户对象
 */
router.post('/login', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: '昵称不能为空' });
        }

        const trimmed = username.trim();

        if (trimmed.length > 20) {
            return res.status(400).json({ error: '昵称不能超过20个字符' });
        }

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
    } catch (err) {
        console.error('[users/login] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/leaderboard
 * 获取全局排行榜 — 累计盈亏、场次、胜率、最大单场赢/亏
 * 注意：此路由必须在 /:id/stats 之前定义，否则 "leaderboard" 会被当作 :id
 */
router.get('/leaderboard', async (_req, res) => {
    try {
        // 获取所有结算记录，join users 获取用户名
        const { data: settlements, error } = await supabase
            .from('settlements')
            .select(`
                user_id,
                net_profit,
                total_buyin,
                users ( id, username )
            `);

        if (error) {
            console.error('[users/leaderboard]', error);
            return res.status(500).json({ error: '获取排行榜失败' });
        }

        if (!settlements || settlements.length === 0) {
            return res.json({ leaderboard: [] });
        }

        // 按 user_id 聚合
        const userMap = new Map<string, {
            userId: string;
            username: string;
            totalGames: number;
            totalProfit: number;
            totalBuyIn: number;
            winCount: number;
            biggestWin: number;
            biggestLoss: number;
        }>();

        for (const s of settlements) {
            const uid = s.user_id as string;
            const username = (s.users as unknown as Record<string, unknown>)?.username as string || '未知';
            const profit = (s.net_profit || 0) as number;
            const buyin = (s.total_buyin || 0) as number;

            if (!userMap.has(uid)) {
                userMap.set(uid, {
                    userId: uid,
                    username,
                    totalGames: 0,
                    totalProfit: 0,
                    totalBuyIn: 0,
                    winCount: 0,
                    biggestWin: 0,
                    biggestLoss: 0,
                });
            }

            const entry = userMap.get(uid)!;
            entry.totalGames += 1;
            entry.totalProfit += profit;
            entry.totalBuyIn += buyin;
            if (profit > 0) entry.winCount += 1;
            if (profit > entry.biggestWin) entry.biggestWin = profit;
            if (profit < entry.biggestLoss) entry.biggestLoss = profit;
        }

        // 转换为数组，按 totalProfit 降序排列
        const leaderboard = Array.from(userMap.values())
            .map(e => ({
                ...e,
                winRate: e.totalGames > 0 ? Math.round((e.winCount / e.totalGames) * 100) : 0,
                avgProfit: e.totalGames > 0 ? Math.round(e.totalProfit / e.totalGames) : 0,
            }))
            .sort((a, b) => b.totalProfit - a.totalProfit);

        return res.json({ leaderboard });
    } catch (err) {
        console.error('[users/leaderboard] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/thirteen-leaderboard
 * 十三水全局排行榜 — 总积分、场次、局数、胜率、打枪、全垒打
 */
router.get('/thirteen-leaderboard', async (_req, res) => {
    try {
        // 获取所有十三水总分记录，join users 获取用户名
        const { data: totals, error } = await supabase
            .from('thirteen_totals')
            .select(`
                user_id,
                final_score,
                guns_fired,
                homerun,
                users ( id, username )
            `);

        if (error) {
            console.error('[users/thirteen-leaderboard]', error);
            return res.status(500).json({ error: '获取十三水排行榜失败' });
        }

        if (!totals || totals.length === 0) {
            return res.json({ leaderboard: [] });
        }

        // 统计每个用户参与了多少个不同的游戏（通过 thirteen_rounds join）
        const { data: roundGameMap } = await supabase
            .from('thirteen_totals')
            .select('user_id, thirteen_rounds!inner(game_id)')
            .not('thirteen_rounds', 'is', null);

        const userGames: Record<string, Set<string>> = {};
        for (const r of (roundGameMap || [])) {
            const uid = r.user_id as string;
            const gid = (r.thirteen_rounds as any)?.game_id;
            if (uid && gid) {
                if (!userGames[uid]) userGames[uid] = new Set();
                userGames[uid].add(gid);
            }
        }

        // 按 user_id 聚合
        const userMap = new Map<string, {
            userId: string;
            username: string;
            totalGames: number;
            totalRounds: number;
            totalScore: number;
            winRounds: number;
            gunCount: number;
            homerunCount: number;
        }>();

        for (const t of totals) {
            const uid = t.user_id as string;
            const username = (t.users as unknown as Record<string, unknown>)?.username as string || '未知';
            const score = (t.final_score || 0) as number;

            if (!userMap.has(uid)) {
                userMap.set(uid, {
                    userId: uid,
                    username,
                    totalGames: userGames[uid]?.size || 0,
                    totalRounds: 0,
                    totalScore: 0,
                    winRounds: 0,
                    gunCount: 0,
                    homerunCount: 0,
                });
            }

            const entry = userMap.get(uid)!;
            entry.totalRounds += 1;
            entry.totalScore += score;
            if (score > 0) entry.winRounds += 1;
            entry.gunCount += (t.guns_fired || 0) as number;
            if (t.homerun) entry.homerunCount += 1;
        }

        const leaderboard = Array.from(userMap.values())
            .map(e => ({
                ...e,
                winRate: e.totalRounds > 0 ? Math.round((e.winRounds / e.totalRounds) * 100) : 0,
                avgScore: e.totalRounds > 0 ? Math.round((e.totalScore / e.totalRounds) * 10) / 10 : 0,
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

        return res.json({ leaderboard });
    } catch (err) {
        console.error('[users/thirteen-leaderboard] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/:id/stats
 * 获取指定用户的历史对局统计数据
 */
router.get('/:id/stats', async (req, res) => {
    try {
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
                gameName: (s.games as Record<string, unknown>)?.name || '未知房间',
                blindLevel: (s.games as Record<string, unknown>)?.blind_level || '?',
                finishedAt: (s.games as Record<string, unknown>)?.finished_at || s.created_at,
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
    } catch (err) {
        console.error('[users/stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/:id/lucky-hands-history
 * 获取指定用户的所有幸运手牌历史记录，按 hit_count 降序排列
 */
router.get('/:id/lucky-hands-history', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('lucky_hands')
            .select(`
                id,
                game_id,
                user_id,
                hand_index,
                card_1,
                card_2,
                hit_count,
                created_at,
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
            .order('hit_count', { ascending: false });

        if (error) {
            console.error('[users/lucky-hands-history]', error);
            return res.status(500).json({ error: '获取幸运手牌历史失败' });
        }

        return res.json({ luckyHands: data || [] });
    } catch (err) {
        console.error('[users/lucky-hands-history] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/:id/thirteen-stats
 * 获取指定用户的13水统计数据
 */
router.get('/:id/thirteen-stats', async (req, res) => {
    try {
        const { id } = req.params;

        // 获取该用户参与过的所有13水游戏
        const { data: playerGames } = await supabase
            .from('game_players')
            .select('game_id, games!inner(id, room_type, status)')
            .eq('user_id', id);

        const thirteenGameIds = (playerGames || [])
            .filter((pg: any) => pg.games?.room_type === 'thirteen')
            .map((pg: any) => pg.game_id);

        if (thirteenGameIds.length === 0) {
            return res.json({
                totalGames: 0,
                totalRounds: 0,
                totalScore: 0,
                winRounds: 0,
                winRate: 0,
                gunCount: 0,
                homerunCount: 0,
            });
        }

        // 获取该用户在所有13水轮次中的汇总
        const { data: totals } = await supabase
            .from('thirteen_totals')
            .select('final_score, guns_fired, homerun, thirteen_rounds!inner(game_id)')
            .eq('user_id', id)
            .in('thirteen_rounds.game_id', thirteenGameIds);

        let totalScore = 0;
        let winRounds = 0;
        let gunCount = 0;
        let homerunCount = 0;

        for (const t of (totals || [])) {
            totalScore += t.final_score || 0;
            if ((t.final_score || 0) > 0) winRounds++;
            gunCount += t.guns_fired || 0;
            if (t.homerun) homerunCount++;
        }

        const totalRounds = (totals || []).length;

        return res.json({
            totalGames: thirteenGameIds.length,
            totalRounds,
            totalScore,
            winRounds,
            winRate: totalRounds > 0 ? Math.round((winRounds / totalRounds) * 100) : 0,
            gunCount,
            homerunCount,
        });
    } catch (err) {
        console.error('[users/thirteen-stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/users/:id/thirteen-history
 * 获取指定用户的13水牌局历史列表
 */
router.get('/:id/thirteen-history', async (req, res) => {
    try {
        const { id } = req.params;

        // 获取用户参与的所有13水游戏
        const { data: playerGames } = await supabase
            .from('game_players')
            .select('game_id, games!inner(id, name, room_type, status, finished_at, created_at)')
            .eq('user_id', id);

        const thirteenGames = (playerGames || [])
            .filter((pg: any) => pg.games?.room_type === 'thirteen' && pg.games?.status === 'finished')
            .map((pg: any) => pg.games);

        if (thirteenGames.length === 0) {
            return res.json({ history: [] });
        }

        const gameIds = thirteenGames.map((g: any) => g.id);

        // 获取每个游戏中该用户的总分
        const { data: totals } = await supabase
            .from('thirteen_totals')
            .select('final_score, thirteen_rounds!inner(game_id)')
            .eq('user_id', id)
            .in('thirteen_rounds.game_id', gameIds);

        // 按游戏汇总分数
        const scoreByGame: Record<string, number> = {};
        for (const t of (totals || [])) {
            const gid = (t.thirteen_rounds as any)?.game_id;
            if (gid) scoreByGame[gid] = (scoreByGame[gid] || 0) + (t.final_score || 0);
        }

        const history = thirteenGames
            .map((g: any) => ({
                gameId: g.id,
                gameName: g.name || '未知房间',
                finishedAt: g.finished_at || g.created_at,
                totalScore: scoreByGame[g.id] || 0,
            }))
            .sort((a: any, b: any) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());

        return res.json({ history });
    } catch (err) {
        console.error('[users/thirteen-history] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
