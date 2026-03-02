import { useEffect, useRef, useCallback } from 'react';
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
): { markPendingSubmitted: (amount: number, type: 'initial' | 'rebuy') => void } {
    const handlersRef = useRef<SSEHandlers>(handlers);
    handlersRef.current = handlers;

    // 记录「我已提交待审核申请」的信息
    const pendingSubmittedRef = useRef<{ amount: number; type: 'initial' | 'rebuy' } | null>(null);

    const markPendingSubmitted = useCallback((amount: number, type: 'initial' | 'rebuy') => {
        pendingSubmittedRef.current = { amount, type };
    }, []);

    useEffect(() => {
        if (!gameId || !userId) return;

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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [gameId, userId]);

    return { markPendingSubmitted };
}
