/**
 * API 客户端封装
 * 统一处理 fetch 请求，base URL 指向 /api（由 Vite proxy 转发到后端）
 */

const BASE_URL = '/api';

async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
): Promise<T> {
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`, options);

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ──────────────────────────── Users API ────────────────────────────────────

export const usersApi = {
    login: (username: string) =>
        request<{ user: { id: string; username: string; created_at: string } }>(
            'POST',
            '/users/login',
            { username }
        ),
    getStats: (userId: string) =>
        request<{
            stats: { totalGames: number; totalProfit: number; totalBuyIn: number; winRate: number };
            history: Array<{ gameId: string; gameName: string; blindLevel: string; finishedAt: string; profit: number; finalChips: number; totalBuyIn: number }>;
        }>('GET', `/users/${userId}/stats`),
};

// ──────────────────────────── Games API ────────────────────────────────────

export interface Game {
    id: string;
    name: string;
    blind_level: string;
    min_buyin: number;
    max_buyin: number;
    insurance_mode: boolean;
    room_code: string;
    status: 'active' | 'finished';
    lucky_hands_count: number;
    created_by: string;
    created_at: string;
    finished_at?: string;
    game_players?: { count: number }[];
    users?: { username: string };
}

export interface BuyIn {
    id: string;
    game_id: string;
    user_id: string;
    amount: number;
    type: 'initial' | 'rebuy' | 'checkout';
    created_at: string;
    users?: { id: string; username: string };
}

export interface Player {
    id: string;
    game_id: string;
    user_id: string;
    joined_at: string;
    users?: { id: string; username: string };
}

export const gamesApi = {
    list: () =>
        request<{ games: Game[] }>('GET', '/games'),

    history: (userId: string) =>
        request<{ games: Game[] }>('GET', `/games/history?userId=${encodeURIComponent(userId)}`),

    get: (id: string) =>
        request<{ game: Game; buyIns: BuyIn[]; players: Player[] }>('GET', `/games/${id}`),

    // 默认创建时开启幸运手牌次数为 0，让房间创建接口能够接收到该值
    create: (name: string, userId: string, blindLevel?: string, minBuyin?: number, maxBuyin?: number, insuranceMode?: boolean, luckyHandsCount?: number) =>
        request<{ game: Game }>('POST', '/games', { name, userId, blindLevel, minBuyin, maxBuyin, insuranceMode, luckyHandsCount }),

    join: (roomCode: string, userId: string) =>
        request<{ game: Game }>('POST', '/games/join', { roomCode, userId }),

    finish: (id: string) =>
        request<{ game: Game }>('POST', `/games/${id}/finish`),
};

// ──────────────────────────── Buy-in API ───────────────────────────────────

export const buyInApi = {
    record: (gameId: string, userId: string, amount: number, type: 'initial' | 'rebuy') =>
        request<{ buyIn: BuyIn }>('POST', '/buyin', { gameId, userId, amount, type }),

    checkout: (gameId: string, userId: string, chips: number) =>
        request<{ checkout: BuyIn }>('POST', '/buyin/checkout', { gameId, userId, chips }),
};

export const pendingBuyInApi = {
    submit: (gameId: string, userId: string, username: string, amount: number, type: 'initial' | 'rebuy') =>
        request<{ request: { id: string } }>('POST', '/buyin/pending', { gameId, userId, username, amount, type }),

    approve: (requestId: string) =>
        request<{ buyIn: BuyIn }>('POST', `/buyin/pending/${requestId}/approve`),

    reject: (requestId: string) =>
        request<{ success: boolean }>('DELETE', `/buyin/pending/${requestId}`),
};


// ──────────────────────────── Settlement API ───────────────────────────────

export interface PlayerStat {
    userId: string;
    username: string;
    totalBuyin: number;
    finalChips: number;
    netProfit: number;
}

export const settlementApi = {
    get: (gameId: string) =>
        request<{ game: Game; stats: PlayerStat[]; hasSettlement: boolean }>(
            'GET',
            `/settlement/${gameId}`
        ),

    submit: (gameId: string, userId: string, playerResults: { userId: string; finalChips: number }[]) =>
        request<{ settlements: unknown[] }>('POST', `/settlement/${gameId}`, { userId, playerResults }),

    finalize: (gameId: string, userId: string, finalChipsMap: Record<string, number>) =>
        request<{ message: string }>('POST', `/settlement/${gameId}/finalize`, { userId, finalChipsMap }),
};

// ──────────────────────────── Lucky Hands API ─────────────────────────────

export interface LuckyHand {
    id: string;
    game_id: string;
    user_id: string;
    hand_index: number;
    card_1: string;
    card_2: string;
    hit_count: number;
    created_at: string;
    users?: { id: string; username: string };
}

export interface PendingLuckyHit {
    id: string;
    game_id: string;
    user_id: string;
    lucky_hand_id: string;
    created_at: string;
    users?: { id: string; username: string };
    lucky_hands?: { card_1: string; card_2: string, hand_index: number };
}

export const luckyHandsApi = {
    getAll: (gameId: string) =>
        request<{ luckyHands: LuckyHand[] }>('GET', `/lucky-hands/${gameId}`),

    setup: (gameId: string, userId: string, handIndex: number, card1: string, card2: string) =>
        request<{ success: boolean; luckyHand: LuckyHand }>('POST', `/lucky-hands/${gameId}/setup`, { userId, handIndex, card1, card2 }),

    getPending: (gameId: string) =>
        request<{ pendingHits: PendingLuckyHit[] }>('GET', `/lucky-hands/${gameId}/pending`),

    submitHit: (gameId: string, userId: string, luckyHandId: string) =>
        request<{ success: boolean; pendingHit: PendingLuckyHit }>('POST', `/lucky-hands/${gameId}/hit-submit`, { userId, luckyHandId }),

    approveHit: (gameId: string, hitId: string) =>
        request<{ success: boolean; newCount: number }>('POST', `/lucky-hands/${gameId}/hit-approve/${hitId}`),

    rejectHit: (gameId: string, hitId: string) =>
        request<{ success: boolean }>('POST', `/lucky-hands/${gameId}/hit-reject/${hitId}`),
};
