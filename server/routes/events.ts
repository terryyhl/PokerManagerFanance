import { Router } from 'express';
import { supabase } from '../supabase.js';
import { addClient, removeClient, SSEClient } from '../sse.js';
import { getPending } from '../pendingRequests.js';

const router = Router();

/**
 * GET /api/events/:gameId?userId=xxx
 * SSE 长连接订阅：客户端连接后实时接收游戏事件
 * EventSource 原生支持断线自动重连（3s 后重试）
 */
router.get('/:gameId', async (req, res) => {
    const { gameId } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: '缺少 userId 参数' });
    }

    let isHost = false;

    // 如果不是大厅频道的订阅，才去查是否为房主
    if (gameId !== 'lobby') {
        const { data: game } = await supabase
            .from('games')
            .select('created_by')
            .eq('id', gameId)
            .single();

        isHost = game?.created_by === userId;
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
        'Access-Control-Allow-Origin': '*',
    });

    // 发送初始连接确认
    res.write(`event: connected\ndata: ${JSON.stringify({ isHost })}\n\n`);

    // 如果是房主，推送当前待审核队列
    if (isHost) {
        const pending = getPending(gameId);
        if (pending.length > 0) {
            res.write(`event: pending_list\ndata: ${JSON.stringify(pending)}\n\n`);
        }
    }

    // 注册客户端
    const client: SSEClient = { res, gameId, userId, isHost };
    addClient(client);

    // 每 25 秒发一次 keep-alive ping，防止代理层超时断开
    const pingInterval = setInterval(() => {
        try {
            res.write(`event: ping\ndata: {}\n\n`);
        } catch {
            clearInterval(pingInterval);
        }
    }, 25000);

    // 客户端断开时清理
    req.on('close', () => {
        clearInterval(pingInterval);
        removeClient(client);
    });
});

export default router;
