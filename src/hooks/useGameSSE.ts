import { useEffect, useRef } from 'react';

export interface SSEHandlers {
    onConnected?: (isHost: boolean) => void;
    onBuyinRequest?: (data: PendingBuyinEvent) => void;
    onPendingList?: (data: PendingBuyinEvent[]) => void;
    onGameRefresh?: (data: { type: string; userId: string }) => void;
    onBuyinApproved?: (data: { amount: number; type: string }) => void;
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
    type: 'initial' | 'rebuy';
    createdAt: string;
}

/**
 * SSE 长连接 Hook
 * - 使用浏览器原生 EventSource（自动断线重连，间隔约 3s）
 * - 组件卸载时自动关闭连接，防止内存泄漏
 */
export function useGameSSE(
    gameId: string | undefined,
    userId: string | undefined,
    handlers: SSEHandlers,
) {
    // 用 ref 存 handlers 避免频繁重新注册 EventSource
    const handlersRef = useRef<SSEHandlers>(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!gameId || !userId) return;

        let es: EventSource | null = null;
        let active = true;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        function connect() {
            if (!active) return;
            const url = `/api/events/${gameId}?userId=${encodeURIComponent(userId!)}`;
            es = new EventSource(url);

            es.addEventListener('connected', (e: MessageEvent) => {
                try {
                    const { isHost } = JSON.parse(e.data);
                    handlersRef.current.onConnected?.(isHost);
                } catch { }
            });

            es.addEventListener('pending_list', (e: MessageEvent) => {
                try { handlersRef.current.onPendingList?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('buyin_request', (e: MessageEvent) => {
                try { handlersRef.current.onBuyinRequest?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('game_refresh', (e: MessageEvent) => {
                try { handlersRef.current.onGameRefresh?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('lobby_refresh', (e: MessageEvent) => {
                try { handlersRef.current.onLobbyRefresh?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('buyin_approved', (e: MessageEvent) => {
                try { handlersRef.current.onBuyinApproved?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('buyin_rejected', (e: MessageEvent) => {
                try { handlersRef.current.onBuyinRejected?.(JSON.parse(e.data)); } catch { }
            });

            es.addEventListener('game_settled', (e: MessageEvent) => {
                try { handlersRef.current.onGameSettled?.(JSON.parse(e.data)); } catch { }
            });

            // ping 事件：忽略即可，仅用于保持连接
            es.addEventListener('ping', () => { });

            es.onerror = () => {
                // EventSource 会自动重试，但如果服务器真的断了则手动重连
                es?.close();
                if (active) {
                    reconnectTimer = setTimeout(connect, 3000);
                }
            };
        }

        connect();

        return () => {
            active = false;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            es?.close();
        };
    }, [gameId, userId]);
}
