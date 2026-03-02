import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

const VALID_TYPES = ['timer', 'egg', 'chicken', 'flower'];

/**
 * POST /api/timer/record
 * 记录一次互动（催促计时 / 扔鸡蛋 / 抓鸡）
 */
router.post('/record', async (req, res) => {
    try {
        const { gameId, targetUserId, startedBy, durationSeconds, type } = req.body;

        if (!gameId || !targetUserId || !startedBy) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const recordType = type || 'timer';
        if (!VALID_TYPES.includes(recordType)) {
            return res.status(400).json({ error: '无效的互动类型' });
        }

        const dur = typeof durationSeconds === 'number' && durationSeconds >= 0 ? Math.round(durationSeconds) : 0;

        const { data, error } = await supabase
            .from('shame_timers')
            .insert({
                game_id: gameId,
                target_user_id: targetUserId,
                started_by: startedBy,
                type: recordType,
                duration_seconds: dur,
            })
            .select()
            .single();

        if (error) {
            console.error('[timer/record]', error);
            return res.status(500).json({ error: '记录失败' });
        }

        return res.status(201).json({ record: data });
    } catch (err) {
        console.error('[timer/record] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/game/:gameId
 * 获取某局游戏所有互动记录（含用户名）
 */
router.get('/game/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        const { data, error } = await supabase
            .from('shame_timers')
            .select(`
                id,
                game_id,
                target_user_id,
                started_by,
                type,
                duration_seconds,
                created_at,
                target:users!shame_timers_target_user_id_fkey ( id, username ),
                starter:users!shame_timers_started_by_fkey ( id, username )
            `)
            .eq('game_id', gameId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[timer/game]', error);
            return res.status(500).json({ error: '获取记录失败' });
        }

        return res.json({ records: data || [] });
    } catch (err) {
        console.error('[timer/game] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/game/:gameId/stats
 * 获取某局游戏中每个玩家的互动统计（分类型）
 */
router.get('/game/:gameId/stats', async (req, res) => {
    try {
        const { gameId } = req.params;

        const { data, error } = await supabase
            .from('shame_timers')
            .select('target_user_id, type, duration_seconds')
            .eq('game_id', gameId);

        if (error) {
            console.error('[timer/game/stats]', error);
            return res.status(500).json({ error: '获取统计失败' });
        }

        // 按 target_user_id 聚合，分类型统计
        const statsMap = new Map<string, {
            timerCount: number; timerTotalSec: number; timerMaxSec: number;
            eggCount: number;
            chickenCount: number;
            flowerCount: number;
        }>();

        for (const r of (data || [])) {
            const uid = r.target_user_id as string;
            const t = (r.type || 'timer') as string;
            const dur = (r.duration_seconds || 0) as number;
            if (!statsMap.has(uid)) {
                statsMap.set(uid, { timerCount: 0, timerTotalSec: 0, timerMaxSec: 0, eggCount: 0, chickenCount: 0, flowerCount: 0 });
            }
            const entry = statsMap.get(uid)!;
            if (t === 'timer') {
                entry.timerCount += 1;
                entry.timerTotalSec += dur;
                if (dur > entry.timerMaxSec) entry.timerMaxSec = dur;
            } else if (t === 'egg') {
                entry.eggCount += 1;
            } else if (t === 'chicken') {
                entry.chickenCount += 1;
            } else if (t === 'flower') {
                entry.flowerCount += 1;
            }
        }

        const stats = Array.from(statsMap.entries()).map(([userId, s]) => ({
            userId,
            timerCount: s.timerCount,
            timerTotalSec: s.timerTotalSec,
            timerAvgSec: s.timerCount > 0 ? Math.round(s.timerTotalSec / s.timerCount) : 0,
            timerMaxSec: s.timerMaxSec,
            eggCount: s.eggCount,
            chickenCount: s.chickenCount,
            flowerCount: s.flowerCount,
        }));

        return res.json({ stats });
    } catch (err) {
        console.error('[timer/game/stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/user/:userId/stats
 * 获取某用户跨所有游戏的互动统计（用于个人中心）
 */
router.get('/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('shame_timers')
            .select('type, duration_seconds')
            .eq('target_user_id', userId);

        if (error) {
            console.error('[timer/user/stats]', error);
            return res.status(500).json({ error: '获取统计失败' });
        }

        const records = data || [];
        let timerCount = 0, timerTotalSec = 0, timerMaxSec = 0;
        let eggCount = 0, chickenCount = 0, flowerCount = 0;

        for (const r of records) {
            const t = (r.type || 'timer') as string;
            const dur = (r.duration_seconds || 0) as number;
            if (t === 'timer') {
                timerCount += 1;
                timerTotalSec += dur;
                if (dur > timerMaxSec) timerMaxSec = dur;
            } else if (t === 'egg') {
                eggCount += 1;
            } else if (t === 'chicken') {
                chickenCount += 1;
            } else if (t === 'flower') {
                flowerCount += 1;
            }
        }

        return res.json({
            stats: {
                timerCount,
                timerTotalSec,
                timerAvgSec: timerCount > 0 ? Math.round(timerTotalSec / timerCount) : 0,
                timerMaxSec,
                eggCount,
                chickenCount,
                flowerCount,
            }
        });
    } catch (err) {
        console.error('[timer/user/stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/leaderboard
 * 全局趣味互动排行榜 — 按 target_user_id 聚合所有互动，带用户名
 */
router.get('/leaderboard', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('shame_timers')
            .select('target_user_id, type');

        if (error) {
            console.error('[timer/leaderboard]', error);
            return res.status(500).json({ error: '获取排行榜失败' });
        }

        // 按 target_user_id 聚合
        const map = new Map<string, { timerCount: number; eggCount: number; chickenCount: number; flowerCount: number }>();

        for (const r of (data || [])) {
            const uid = r.target_user_id as string;
            const t = (r.type || 'timer') as string;
            if (!map.has(uid)) {
                map.set(uid, { timerCount: 0, eggCount: 0, chickenCount: 0, flowerCount: 0 });
            }
            const entry = map.get(uid)!;
            if (t === 'timer') entry.timerCount += 1;
            else if (t === 'egg') entry.eggCount += 1;
            else if (t === 'chicken') entry.chickenCount += 1;
            else if (t === 'flower') entry.flowerCount += 1;
        }

        // 获取相关用户名
        const userIds = Array.from(map.keys());
        if (userIds.length === 0) {
            return res.json({ leaderboard: [] });
        }

        const { data: users, error: userErr } = await supabase
            .from('users')
            .select('id, username')
            .in('id', userIds);

        if (userErr) {
            console.error('[timer/leaderboard] users fetch', userErr);
            return res.status(500).json({ error: '获取用户信息失败' });
        }

        const usernameMap = new Map<string, string>();
        for (const u of (users || [])) {
            usernameMap.set(u.id, u.username);
        }

        const leaderboard = Array.from(map.entries()).map(([userId, s]) => ({
            userId,
            username: usernameMap.get(userId) || '未知用户',
            timerCount: s.timerCount,
            eggCount: s.eggCount,
            chickenCount: s.chickenCount,
            flowerCount: s.flowerCount,
            totalInteractions: s.timerCount + s.eggCount + s.chickenCount + s.flowerCount,
        }));

        // 默认按 totalInteractions 降序
        leaderboard.sort((a, b) => b.totalInteractions - a.totalInteractions);

        return res.json({ leaderboard });
    } catch (err) {
        console.error('[timer/leaderboard] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
