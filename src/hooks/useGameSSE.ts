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

    // 记录「我已提交待审核申请」的信息：{ amount, type }
    // Key = gameId，Value = 提交信息（只需记录最新一条）
    const pendingSubmittedRef = useRef<{ amount: number; type: 'initial' | 'rebuy' } | null>(null);

    const markPendingSubmitted = (amount: number, type: 'initial' | 'rebuy') => {
        pendingSubmittedRef.current = { amount, type };
    };

    useEffect(() => {
        if (!gameId || !userId) return;

        // ─── Supabase Realtime 订阅 ──────────────────────────────────────────
        const buyinsChannel = supabase.channel(`game:${gameId}:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'buy_ins', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    const newBuyin = payload.new as any;

                    if (newBuyin.type === 'checkout') return; // 忽略结账记录

                    if (newBuyin.user_id === userId) {
                        // 是我自己的买入记录被写入
                        const pending = pendingSubmittedRef.current;
                        if (pending) {
                            // 曾提交过待审核申请 → 视为审批通过，触发弹窗 + 数据刷新
                            pendingSubmittedRef.current = null;
                            handlersRef.current.onBuyinApproved?.({
                                amount: newBuyin.amount,
                                type: newBuyin.type,
                            });
                            // 同时触发数据刷新，确保用户端列表实时更新
                            handlersRef.current.onGameRefresh?.({
                                type: 'buyin_approved',
                                userId: newBuyin.user_id,
                            });
                        } else {
                            // 直接买入（无审核）→ 仅刷新数据，不弹窗
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
                    const req = payload.new as any;

                    // 只有「别人」提交的申请才通知房主显示；
                    // 自己提交的申请自己已经知道，不需要弹提示
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
                (_payload) => {
                    // 申请被删除（批准或拒绝）→ 触发刷新，同步房主侧的待审核列表
                    // 申请人侧的「审批通过」通知已经在 buy_ins INSERT 中处理
                    handlersRef.current.onGameRefresh?.({ type: 'pending_update', userId: userId! });
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

        // ─── 旧 SSE 通道（本地开发备用）────────────────────────────────────
        // 主要用于本地部署下的审批通知，Vercel 下会频繁重连但不影响主流程
        const url = `/api/events/${gameId}?userId=${encodeURIComponent(userId!)}`;
        const es = new EventSource(url);

        es.addEventListener('connected', (e: any) => {
            try { handlersRef.current.onConnected?.(JSON.parse(e.data).isHost); } catch { }
        });
        es.addEventListener('pending_list', (e: any) => {
            try { handlersRef.current.onPendingList?.(JSON.parse(e.data)); } catch { }
        });
        // SSE buyin_approved 作为 Supabase Realtime 的备用通道
        es.addEventListener('buyin_approved', (e: any) => {
            try {
                // 如果 Supabase Realtime 已经处理过了（pendingSubmittedRef 已清除），跳过
                if (!pendingSubmittedRef.current) return;
                pendingSubmittedRef.current = null;
                handlersRef.current.onBuyinApproved?.(JSON.parse(e.data));
            } catch { }
        });
        es.addEventListener('buyin_rejected', (e: any) => {
            try { handlersRef.current.onBuyinRejected?.(JSON.parse(e.data)); } catch { }
        });

        return () => {
            supabase.removeChannel(buyinsChannel);
            es.close();
        };
    }, [gameId, userId]);

    return { markPendingSubmitted };
}
