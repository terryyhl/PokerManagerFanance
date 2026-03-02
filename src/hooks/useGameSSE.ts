import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ActiveTimerEvent {
    targetUserId: string;
    targetUsername: string;
    startedBy: string;
    startedByUsername: string;
    totalSeconds: number;
    startedAt: number; // Date.now() 时间戳
}

export interface InteractionEvent {
    type: 'egg' | 'chicken' | 'flower';
    targetUserId: string;
    targetUsername: string;
    startedBy: string;
    startedByUsername: string;
}

export interface SSEHandlers {
    onConnected?: (isHost: boolean) => void;
    onBuyinRequest?: (data: PendingBuyinEvent) => void;
    onPendingList?: (data: PendingBuyinEvent[]) => void;
    onGameRefresh?: (data: { type: string; userId: string; username?: string; amount?: number; totalAmount?: number }) => void;
    onBuyinApproved?: (data: { amount: number; type: string; totalAmount?: number }) => void;
    onBuyinRejected?: (data: { amount: number; type: string; requestId: string }) => void;
    onGameSettled?: (data: { message: string }) => void;
    onLobbyRefresh?: (data: { gameId: string }) => void;
    onShameTimer?: (data: { targetUserId: string; startedBy: string; durationSeconds: number }) => void;
    onTimerStart?: (data: ActiveTimerEvent) => void;
    onTimerStop?: (data: { targetUserId: string }) => void;
    onInteraction?: (data: InteractionEvent) => void;
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

interface SupabaseBuyInPayload {
    user_id: string;
    amount: number;
    type: string;
}

interface SupabasePendingBuyinPayload {
    id: string;
    game_id: string;
    user_id: string;
    username: string;
    amount: number;
    total_buyin: number;
    type: 'initial' | 'rebuy';
    created_at: string;
}

interface SupabaseGamePayload {
    status: string;
}

/**
 * Supabase Realtime 实时订阅 Hook
 * 已移除 SSE 通道，统一使用 Supabase Realtime
 *
 * 返回值包含 markPendingSubmitted，供 GameRoom 在提交待审核申请后调用，
 * 以便 Hook 知道「我有待审核申请」，从而在 buy_ins INSERT 时识别为
 * 审批通过事件触发 onBuyinApproved。
 */
export function useGameSSE(
    gameId: string | undefined,
    userId: string | undefined,
    handlers: SSEHandlers,
): {
    markPendingSubmitted: (amount: number, type: 'initial' | 'rebuy') => void;
    broadcastTimerStart: (data: ActiveTimerEvent) => void;
    broadcastTimerStop: (targetUserId: string) => void;
    broadcastInteraction: (data: InteractionEvent) => void;
    setActiveTimerRef: (data: ActiveTimerEvent | null) => void;
} {
    const handlersRef = useRef<SSEHandlers>(handlers);
    handlersRef.current = handlers;

    // 记录「我已提交待审核申请」的信息
    const pendingSubmittedRef = useRef<{ amount: number; type: 'initial' | 'rebuy' } | null>(null);
    const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    // 记录当前活跃的催促计时器（用于 sync_request 响应）
    const activeTimerRef = useRef<ActiveTimerEvent | null>(null);

    const markPendingSubmitted = useCallback((amount: number, type: 'initial' | 'rebuy') => {
        pendingSubmittedRef.current = { amount, type };
    }, []);

    const setActiveTimerRef = useCallback((data: ActiveTimerEvent | null) => {
        activeTimerRef.current = data;
    }, []);

    const broadcastTimerStart = useCallback((data: ActiveTimerEvent) => {
        activeTimerRef.current = data;
        broadcastChannelRef.current?.send({ type: 'broadcast', event: 'timer_start', payload: data });
    }, []);

    const broadcastTimerStop = useCallback((targetUserId: string) => {
        activeTimerRef.current = null;
        broadcastChannelRef.current?.send({ type: 'broadcast', event: 'timer_stop', payload: { targetUserId } });
    }, []);

    const broadcastInteraction = useCallback((data: InteractionEvent) => {
        broadcastChannelRef.current?.send({ type: 'broadcast', event: 'interaction', payload: data });
    }, []);

    useEffect(() => {
        if (!gameId || !userId) return;

        // ─── Supabase Broadcast 频道（用于催促计时器实时同步） ────────────────
        // self: true 让发送者自己也能收到广播（用于互动动画同步）
        const broadcastChannel = supabase.channel(`game-broadcast:${gameId}`, {
            config: { broadcast: { self: true } },
        })
            .on('broadcast', { event: 'timer_start' }, (payload) => {
                const data = payload.payload as ActiveTimerEvent;
                // 发起者已在 broadcastTimerStart 中设置了 activeTimerRef，跳过重复处理
                if (data.startedBy === userId && activeTimerRef.current?.startedAt === data.startedAt) return;
                activeTimerRef.current = data;
                handlersRef.current.onTimerStart?.(data);
            })
            .on('broadcast', { event: 'timer_stop' }, (payload) => {
                const data = payload.payload as { targetUserId: string };
                // 发起者已在 broadcastTimerStop 中清除了 activeTimerRef，跳过重复处理
                if (!activeTimerRef.current) return;
                activeTimerRef.current = null;
                handlersRef.current.onTimerStop?.(data);
            })
            .on('broadcast', { event: 'interaction' }, (payload) => {
                const data = payload.payload as InteractionEvent;
                handlersRef.current.onInteraction?.(data);
            })
            .on('broadcast', { event: 'sync_request' }, () => {
                // 只有计时器发起者回复，避免多人同时响应
                const timer = activeTimerRef.current;
                if (timer && timer.startedBy === userId) {
                    broadcastChannel.send({
                        type: 'broadcast',
                        event: 'sync_response',
                        payload: { activeTimer: timer },
                    });
                }
            })
            .on('broadcast', { event: 'sync_response' }, (payload) => {
                const data = payload.payload as { activeTimer: ActiveTimerEvent | null };
                if (data.activeTimer && !activeTimerRef.current) {
                    activeTimerRef.current = data.activeTimer;
                    handlersRef.current.onTimerStart?.(data.activeTimer);
                }
            })
            .subscribe((status) => {
                // 订阅成功后发送同步请求，获取当前房间状态
                if (status === 'SUBSCRIBED') {
                    setTimeout(() => {
                        broadcastChannel.send({
                            type: 'broadcast',
                            event: 'sync_request',
                            payload: { userId },
                        });
                    }, 500);
                }
            });
        broadcastChannelRef.current = broadcastChannel;

        // ─── Supabase Realtime 订阅 ──────────────────────────────────────────
        const channel = supabase.channel(`game:${gameId}:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'buy_ins', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const newBuyin = payload.new as SupabaseBuyInPayload;

                    // 结账记录：通知所有人刷新数据（显示谁已结账）
                    if (newBuyin.type === 'checkout') {
                        handlersRef.current.onGameRefresh?.({
                            type: 'checkout',
                            userId: newBuyin.user_id,
                        });
                        return;
                    }

                    if (newBuyin.user_id === userId) {
                        // 是我自己的买入记录被写入
                        const pending = pendingSubmittedRef.current;
                        if (pending) {
                            // 曾提交过待审核申请 → 视为审批通过
                            pendingSubmittedRef.current = null;
                            handlersRef.current.onBuyinApproved?.({
                                amount: newBuyin.amount,
                                type: newBuyin.type,
                            });
                            handlersRef.current.onGameRefresh?.({
                                type: 'buyin_approved',
                                userId: newBuyin.user_id,
                            });
                        } else {
                            // 直接买入（无审核）→ 仅刷新数据
                            handlersRef.current.onGameRefresh?.({
                                type: 'buyin',
                                userId: newBuyin.user_id,
                            });
                        }
                    } else {
                        // 别人的买入消息 → 直接刷新
                        handlersRef.current.onGameRefresh?.({
                            type: 'buyin',
                            userId: newBuyin.user_id,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'pending_buyins', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const req = payload.new as SupabasePendingBuyinPayload;

                    // 只有「别人」提交的申请才通知房主显示
                    if (req.user_id === userId) return;

                    const event: PendingBuyinEvent = {
                        id: req.id,
                        gameId: req.game_id,
                        userId: req.user_id,
                        username: req.username,
                        amount: req.amount,
                        totalBuyIn: req.total_buyin,
                        type: req.type,
                        createdAt: req.created_at,
                    };
                    handlersRef.current.onBuyinRequest?.(event);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'pending_buyins', filter: `game_id=eq.${gameId}` },
                () => {
                    // 申请被删除（批准或拒绝）→ 触发刷新
                    handlersRef.current.onGameRefresh?.({ type: 'pending_update', userId: userId });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => {
                    const updatedGame = payload.new as SupabaseGamePayload;
                    if (updatedGame.status === 'finished') {
                        handlersRef.current.onGameSettled?.({ message: '牌局已结算完成' });
                    } else {
                        handlersRef.current.onGameRefresh?.({ type: 'game_update', userId: userId });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lucky_hands', filter: `game_id=eq.${gameId}` },
                () => {
                    handlersRef.current.onGameRefresh?.({ type: 'lucky_hands_update', userId: userId });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pending_lucky_hits', filter: `game_id=eq.${gameId}` },
                () => {
                    handlersRef.current.onGameRefresh?.({ type: 'pending_lucky_hits_update', userId: userId });
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const newPlayer = payload.new as { user_id: string };
                    // 别人加入房间 → 刷新数据以同步玩家头像
                    if (newPlayer.user_id !== userId) {
                        handlersRef.current.onGameRefresh?.({ type: 'player_joined', userId: newPlayer.user_id });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'shame_timers', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const record = payload.new as { target_user_id: string; started_by: string; duration_seconds: number };
                    handlersRef.current.onShameTimer?.({
                        targetUserId: record.target_user_id,
                        startedBy: record.started_by,
                        durationSeconds: record.duration_seconds,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(broadcastChannel);
            broadcastChannelRef.current = null;
        };
    }, [gameId, userId]);

    return { markPendingSubmitted, broadcastTimerStart, broadcastTimerStop, broadcastInteraction, setActiveTimerRef };
}
