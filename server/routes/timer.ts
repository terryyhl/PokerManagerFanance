import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

/**
 * POST /api/timer/record
 * 记录一次思考计时（催促）
 */
router.post('/record', async (req, res) => {
    try {
        const { gameId, targetUserId, startedBy, durationSeconds } = req.body;

        if (!gameId || !targetUserId || !startedBy || durationSeconds == null) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        if (typeof durationSeconds !== 'number' || durationSeconds < 0) {
            return res.status(400).json({ error: '时长参数无效' });
        }

        const { data, error } = await supabase
            .from('shame_timers')
            .insert({
                game_id: gameId,
                target_user_id: targetUserId,
                started_by: startedBy,
                duration_seconds: Math.round(durationSeconds),
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
 * 获取某局游戏所有计时记录（含用户名）
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
                duration_seconds,
                created_at,
                target:users!shame_timers_target_user_id_fkey ( id, username ),
                starter:users!shame_timers_started_by_fkey ( id, username )
            `)
            .eq('game_id', gameId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[timer/game]', error);
            return res.status(500).json({ error: '获取计时记录失败' });
        }

        return res.json({ records: data || [] });
    } catch (err) {
        console.error('[timer/game] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/game/:gameId/stats
 * 获取某局游戏中每个玩家的计时统计
 */
router.get('/game/:gameId/stats', async (req, res) => {
    try {
        const { gameId } = req.params;

        const { data, error } = await supabase
            .from('shame_timers')
            .select('target_user_id, duration_seconds')
            .eq('game_id', gameId);

        if (error) {
            console.error('[timer/game/stats]', error);
            return res.status(500).json({ error: '获取统计失败' });
        }

        // 按 target_user_id 聚合
        const statsMap = new Map<string, { count: number; totalSeconds: number; maxSeconds: number }>();
        for (const r of (data || [])) {
            const uid = r.target_user_id as string;
            const dur = (r.duration_seconds || 0) as number;
            if (!statsMap.has(uid)) {
                statsMap.set(uid, { count: 0, totalSeconds: 0, maxSeconds: 0 });
            }
            const entry = statsMap.get(uid)!;
            entry.count += 1;
            entry.totalSeconds += dur;
            if (dur > entry.maxSeconds) entry.maxSeconds = dur;
        }

        const stats = Array.from(statsMap.entries()).map(([userId, s]) => ({
            userId,
            count: s.count,
            totalSeconds: s.totalSeconds,
            avgSeconds: s.count > 0 ? Math.round(s.totalSeconds / s.count) : 0,
            maxSeconds: s.maxSeconds,
        }));

        return res.json({ stats });
    } catch (err) {
        console.error('[timer/game/stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

/**
 * GET /api/timer/user/:userId/stats
 * 获取某用户跨所有游戏的计时统计（用于个人中心）
 */
router.get('/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('shame_timers')
            .select('duration_seconds')
            .eq('target_user_id', userId);

        if (error) {
            console.error('[timer/user/stats]', error);
            return res.status(500).json({ error: '获取统计失败' });
        }

        const records = data || [];
        const count = records.length;
        const totalSeconds = records.reduce((sum, r) => sum + ((r.duration_seconds || 0) as number), 0);
        const maxSeconds = records.reduce((max, r) => Math.max(max, (r.duration_seconds || 0) as number), 0);
        const avgSeconds = count > 0 ? Math.round(totalSeconds / count) : 0;

        return res.json({
            stats: {
                timedCount: count,
                totalSeconds,
                avgSeconds,
                maxSeconds,
            }
        });
    } catch (err) {
        console.error('[timer/user/stats] Unhandled error:', err);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

export default router;
