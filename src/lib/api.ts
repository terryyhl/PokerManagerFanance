/**
 * API 客户端封装
 * 统一处理 fetch 请求，base URL 指向 /api（由 Vite proxy 转发到后端）
 */

const BASE_URL = '/api';

async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
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

export interface LuckyHandHistory {
    id: string;
    game_id: string;
    user_id: string;
    hand_index: number;
    card_1: string;
    card_2: string;
    hit_count: number;
    created_at: string;
    games?: {
        id: string;
        name: string;
        blind_level: string;
        status: string;
        created_at: string;
        finished_at?: string;
    };
}

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
    getLuckyHandsHistory: (userId: string) =>
        request<{ luckyHands: LuckyHandHistory[] }>('GET', `/users/${userId}/lucky-hands-history`),
    getLeaderboard: () =>
        request<{ leaderboard: LeaderboardEntry[] }>('GET', '/users/leaderboard'),
    getThirteenLeaderboard: () =>
        request<{ leaderboard: ThirteenLeaderboardEntry[] }>('GET', '/users/thirteen-leaderboard'),
    getThirteenStats: (userId: string) =>
        request<{
            totalGames: number; totalRounds: number; totalScore: number;
            winRounds: number; winRate: number; gunCount: number; homerunCount: number;
        }>('GET', `/users/${userId}/thirteen-stats`),
    getThirteenHistory: (userId: string) =>
        request<{
            history: Array<{ gameId: string; gameName: string; finishedAt: string; totalScore: number }>;
        }>('GET', `/users/${userId}/thirteen-history`),
    updateUsername: (userId: string, username: string) =>
        request<{ user: { id: string; username: string; created_at: string } }>(
            'PATCH',
            `/users/${userId}/username`,
            { username }
        ),
};

export interface LeaderboardEntry {
    userId: string;
    username: string;
    totalGames: number;
    totalProfit: number;
    totalBuyIn: number;
    winCount: number;
    winRate: number;
    avgProfit: number;
    biggestWin: number;
    biggestLoss: number;
}

export interface ThirteenLeaderboardEntry {
    userId: string;
    username: string;
    totalGames: number;
    totalRounds: number;
    totalScore: number;
    winRounds: number;
    winRate: number;
    avgScore: number;
    gunCount: number;
    homerunCount: number;
}

// ──────────────────────────── Games API ────────────────────────────────────

export type RoomType = 'texas' | 'thirteen';

export interface Game {
    id: string;
    name: string;
    room_type: RoomType;
    blind_level: string;
    min_buyin: number;
    max_buyin: number;
    insurance_mode: boolean;
    room_code: string;
    status: 'active' | 'finished';
    lucky_hands_count: number;
    points_per_hand: number;
    max_hands_per_buy: number;
    // 13水专属配置
    thirteen_base_score: number;
    thirteen_ghost_count: number;
    thirteen_compare_suit: boolean;
    thirteen_max_players: number;
    thirteen_time_limit: number;
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
    type: 'initial' | 'rebuy' | 'checkout' | 'seat_report' | 'withdraw';
    created_by?: string | null;
    hand_count?: number | null;
    points_per_hand?: number | null;
    created_at: string;
    users?: { id: string; username: string };
}

export interface Player {
    id: string;
    game_id: string;
    user_id: string;
    nickname?: string | null;
    seat_number?: number | null;
    joined_at: string;
    users?: { id: string; username: string };
}

export interface CreateGameOptions {
    name: string;
    userId: string;
    roomType?: RoomType;
    // 德州配置
    blindLevel?: string;
    minBuyin?: number;
    maxBuyin?: number;
    insuranceMode?: boolean;
    luckyHandsCount?: number;
    pointsPerHand?: number;
    maxHandsPerBuy?: number;
    // 13水配置
    thirteenBaseScore?: number;
    thirteenGhostCount?: number;
    thirteenCompareSuit?: boolean;
    thirteenMaxPlayers?: number;
    thirteenTimeLimit?: number;
}

export const gamesApi = {
    list: () =>
        request<{ games: Game[] }>('GET', '/games'),

    history: (userId: string) =>
        request<{ games: Game[] }>('GET', `/games/history?userId=${encodeURIComponent(userId)}`),

    get: (id: string) =>
        request<{ game: Game; buyIns: BuyIn[]; players: Player[] }>('GET', `/games/${id}`),

    create: (opts: CreateGameOptions) =>
        request<{ game: Game }>('POST', '/games', opts),

    join: (roomCode: string, userId: string) =>
        request<{ game: Game }>('POST', '/games/join', { roomCode, userId }),

    finish: (id: string, userId: string) =>
        request<{ game: Game }>('POST', `/games/${id}/finish`, { userId }),

    assignSeats: (id: string, assignments: Array<{ userId: string; seatNumber: number }>, assignedBy: string) =>
        request<{ success: boolean }>('POST', `/games/${id}/seat-assign`, { assignments, assignedBy }),

    reportSeat: (id: string, userId: string, seatNumber: number) =>
        request<{ success: boolean; seatNumber: number }>('POST', `/games/${id}/seat-report`, { userId, seatNumber }),

    autoCreatePlayer: (username: string, gameId: string) =>
        request<{ userId: string; username: string }>('POST', '/games/auto-create-player', { username, gameId }),

    getFullState: (id: string, userId: string) =>
        request<{
            game: Game;
            buyIns: BuyIn[];
            players: Player[];
            pendingRequests: Array<{ id: string; gameId: string; userId: string; username: string; amount: number; totalBuyIn: number; type: 'initial' | 'rebuy'; createdAt: string }>;
            luckyHands: LuckyHand[];
            pendingLuckyHits: PendingLuckyHit[];
        }>('GET', `/games/${id}/full-state?userId=${encodeURIComponent(userId)}`),
};

// ──────────────────────────── Buy-in API ───────────────────────────────────

export const buyInApi = {
    record: (gameId: string, userId: string, handCount: number, type: 'initial' | 'rebuy', createdBy?: string) =>
        request<{ buyIn: BuyIn; totalAmount: number }>('POST', '/buyin', { gameId, userId, handCount, type, createdBy }),

    checkout: (gameId: string, userId: string, chips: number, createdBy?: string) =>
        request<{ checkout: BuyIn }>('POST', '/buyin/checkout', { gameId, userId, chips, createdBy }),

    withdraw: (gameId: string, userId: string, handCount: number, createdBy?: string) =>
        request<{ withdraw: BuyIn; totalAmount: number }>('POST', '/buyin/withdraw', { gameId, userId, handCount, createdBy }),
};

export const pendingBuyInApi = {
    getList: (gameId: string) =>
        request<{ requests: Array<{ id: string; gameId: string; userId: string; username: string; amount: number; totalBuyIn: number; type: 'initial' | 'rebuy'; handCount?: number; pointsPerHand?: number; createdAt: string }> }>('GET', `/buyin/pending/${gameId}`),

    submit: (gameId: string, userId: string, username: string, handCount: number, type: 'initial' | 'rebuy') =>
        request<{ request: { id: string } }>('POST', '/buyin/pending', { gameId, userId, username, handCount, type }),

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
    request_type?: string;
    new_card_1?: string;
    new_card_2?: string;
    users?: { id: string; username: string };
    lucky_hands?: { card_1: string; card_2: string, hand_index: number };
}

// ──────────────────────────── Player Stats API (game-specific) ─────────────

export interface PlayerBuyInRecord {
    amount: number;
    type: string;
    created_by?: string | null;
    hand_count?: number | null;
    created_at: string;
}

export const playerStatsApi = {
    /** 获取某玩家在某局的买入记录和幸运手牌 */
    getBuyIns: (gameId: string, userId: string) =>
        request<{ buyIns: PlayerBuyInRecord[] }>('GET', `/buyin/player/${gameId}/${userId}`),
};

// ──────────────────────────── Lucky Hands API ─────────────────────────────

// ──────────────────────────── Timer (Shame Timer) API ──────────────────────

export type InteractionType = 'timer' | 'egg' | 'chicken' | 'flower';

export interface ShameTimerRecord {
    id: string;
    game_id: string;
    target_user_id: string;
    started_by: string;
    type: InteractionType;
    duration_seconds: number;
    created_at: string;
    target?: { id: string; username: string };
    starter?: { id: string; username: string };
}

export interface ShameTimerGameStats {
    userId: string;
    timerCount: number;
    timerTotalSec: number;
    timerAvgSec: number;
    timerMaxSec: number;
    eggCount: number;
    chickenCount: number;
    flowerCount: number;
}

export interface ShameTimerUserStats {
    timerCount: number;
    timerTotalSec: number;
    timerAvgSec: number;
    timerMaxSec: number;
    eggCount: number;
    chickenCount: number;
    flowerCount: number;
}

export interface InteractionLeaderboardEntry {
    userId: string;
    username: string;
    timerCount: number;
    eggCount: number;
    chickenCount: number;
    flowerCount: number;
    totalInteractions: number;
}

export const timerApi = {
    /** 记录一次互动（计时/扔鸡蛋/抓鸡） */
    record: (gameId: string, targetUserId: string, startedBy: string, type: InteractionType, durationSeconds?: number) =>
        request<{ record: ShameTimerRecord }>('POST', '/timer/record', { gameId, targetUserId, startedBy, type, durationSeconds: durationSeconds || 0 }),

    /** 获取某局所有互动记录 */
    getGameRecords: (gameId: string) =>
        request<{ records: ShameTimerRecord[] }>('GET', `/timer/game/${gameId}`),

    /** 获取某局每人互动统计 */
    getGameStats: (gameId: string) =>
        request<{ stats: ShameTimerGameStats[] }>('GET', `/timer/game/${gameId}/stats`),

    /** 获取某用户跨游戏的互动统计（个人中心用） */
    getUserStats: (userId: string) =>
        request<{ stats: ShameTimerUserStats }>('GET', `/timer/user/${userId}/stats`),

    /** 全局趣味互动排行榜 */
    getLeaderboard: () =>
        request<{ leaderboard: InteractionLeaderboardEntry[] }>('GET', '/timer/leaderboard'),
};

export const luckyHandsApi = {
    getAll: (gameId: string) =>
        request<{ luckyHands: LuckyHand[] }>('GET', `/lucky-hands/${gameId}`),

    setup: (gameId: string, userId: string, handIndex: number, card1: string, card2: string) =>
        request<{ success: boolean; luckyHand: LuckyHand }>('POST', `/lucky-hands/${gameId}/setup`, { userId, handIndex, card1, card2 }),

    getPending: (gameId: string) =>
        request<{ pendingHits: PendingLuckyHit[] }>('GET', `/lucky-hands/${gameId}/pending`),

    submitHit: (gameId: string, userId: string, luckyHandId: string) =>
        request<{ success: boolean; pendingHit: PendingLuckyHit }>('POST', `/lucky-hands/${gameId}/hit-submit`, { userId, luckyHandId }),

    requestUpdate: (gameId: string, userId: string, luckyHandId: string, newCard1: string, newCard2: string) =>
        request<{ success: boolean; pendingUpdate: PendingLuckyHit }>('POST', `/lucky-hands/${gameId}/update-submit`, { userId, luckyHandId, newCard1, newCard2 }),

    hostDirectHit: (gameId: string, userId: string, luckyHandId: string) =>
        request<{ success: boolean; newCount: number }>('POST', `/lucky-hands/${gameId}/hit-direct`, { userId, luckyHandId }),

    approveHit: (gameId: string, hitId: string) =>
        request<{ success: boolean; newCount: number }>('POST', `/lucky-hands/${gameId}/hit-approve/${hitId}`),

    rejectHit: (gameId: string, hitId: string) =>
        request<{ success: boolean }>('POST', `/lucky-hands/${gameId}/hit-reject/${hitId}`),
};
