import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface SSEHandlers {
    onConnected?: (isHost: boolean) => void;
    onBuyinRequest?: (data: PendingBuyinEvent) => void;
    onPendingList?: (data: PendingBuyinEvent[]) => void;
    onGameRefresh?: (data: { type: string; userId: string; username?: string; amount?: number; totalAmount?: number }) => void;
    onBuyinApproved?: (data: { amount: number; type: string; totalAmount?: number }) => void;
    onBuyinRejected?: (data: { amount: number; type: string; requestId: string }) => void;
    onGameSettled?: (data: { message: string }) => void;
    onLobbyRefresh?: (data: { gameId: string }) => void;
}

export interface PendingBuyinEvent {
    id: string;
    gameId: string;
    userId: string;
    username: string;
    amount: number;
    totalBuyIn?: number;
    type: 'initial' | 'rebuy';
    createdAt: string;
}

/**
 * SSE & Supabase Realtime Hybrid Hook
 * - 在 Vercel Serverless 下，传统的长连接 SSE 极其不稳定。
 * - 我们切换到 Supabase Realtime (WebSockets) 来监听数据库表的变化。
 */
export function useGameSSE(
    gameId: string | undefined,
    userId: string | undefined,
    handlers: SSEHandlers,
) {
    const handlersRef = useRef<SSEHandlers>(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!gameId || !userId) return;

        // ─── 1. Supabase Realtime 订阅 ──────────────────────────────────────
        // 监听买入记录表的变化
        const buyinsChannel = supabase.channel(`game:${gameId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'buy_ins', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const newBuyin = payload.new as any;
                    // 如果是我的买入成功的通知（由后端触发 buyin_approved 或者直接买入）
                    if (newBuyin.user_id === userId) {
                        if (newBuyin.type === 'checkout') return; // 忽略结账
                        // 注意：这里我们无法直接拿到 totalAmount，除非后端在写入时也包含它。
                        // 但我们可以触发 refresh 让前端 fetch。
                        handlersRef.current.onGameRefresh?.({
                            type: 'buyin',
                            userId: newBuyin.user_id
                        });
                    } else {
                        // 别人的买入消息，直接刷新
                        handlersRef.current.onGameRefresh?.({
                            type: 'buyin',
                            userId: newBuyin.user_id
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pending_buyins', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const req = payload.new as any;
                        const event: PendingBuyinEvent = {
                            id: req.id,
                            gameId: req.game_id,
                            userId: req.user_id,
                            username: req.username,
                            amount: req.amount,
                            totalBuyIn: req.total_buyin,
                            type: req.type,
                            createdAt: req.created_at
                        };
                        handlersRef.current.onBuyinRequest?.(event);
                    } else if (payload.eventType === 'DELETE') {
                        // 申请被删除（批准或拒绝），通知主界面刷新同步
                        handlersRef.current.onGameRefresh?.({ type: 'pending_update', userId: userId! });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => {
                    const updatedGame = payload.new as any;
                    if (updatedGame.status === 'finished') {
                        handlersRef.current.onGameSettled?.({ message: '牌局已结算完成' });
                    } else {
                        handlersRef.current.onGameRefresh?.({ type: 'game_update', userId: userId! });
                    }
                }
            )
            .subscribe();

        // ─── 2. 旧 SSE 通道 ────────────────────────────────────────────────
        // 如果后端部署在支持长期连接的服务器上，SSE 仍然有用。但在 Vercel 下它会频繁重连。
        const url = `/api/events/${gameId}?userId=${encodeURIComponent(userId!)}`;
        const es = new EventSource(url);

        es.addEventListener('connected', (e: any) => {
            try { handlersRef.current.onConnected?.(JSON.parse(e.data).isHost); } catch { }
        });
        es.addEventListener('pending_list', (e: any) => {
            try { handlersRef.current.onPendingList?.(JSON.parse(e.data)); } catch { }
        });
        es.addEventListener('buyin_approved', (e: any) => {
            try { handlersRef.current.onBuyinApproved?.(JSON.parse(e.data)); } catch { }
        });
        es.addEventListener('buyin_rejected', (e: any) => {
            try { handlersRef.current.onBuyinRejected?.(JSON.parse(e.data)); } catch { }
        });

        return () => {
            supabase.removeChannel(buyinsChannel);
            es.close();
        };
    }, [gameId, userId]);
}

