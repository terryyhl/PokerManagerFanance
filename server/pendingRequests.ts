import { supabase } from './supabase.js';

export interface PendingBuyinRequest {
    id: string;
    gameId: string;
    userId: string;
    username: string;
    amount: number;
    totalBuyIn: number;
    type: 'initial' | 'rebuy';
    handCount?: number;
    pointsPerHand?: number;
    createdAt: string;
}

export async function addPending(req: Omit<PendingBuyinRequest, 'id' | 'createdAt'>): Promise<PendingBuyinRequest> {
    const { data, error } = await supabase
        .from('pending_buyins')
        .insert({
            game_id: req.gameId,
            user_id: req.userId,
            username: req.username,
            amount: req.amount,
            total_buyin: req.totalBuyIn,
            type: req.type,
            ...(req.handCount ? { hand_count: req.handCount } : {}),
            ...(req.pointsPerHand ? { points_per_hand: req.pointsPerHand } : {}),
        })
        .select()
        .single();

    if (error) {
        console.error('[pendingRequests] addPending error:', error);
        throw new Error('保存申请失败，请稍后重试');
    }

    return {
        id: data.id,
        gameId: data.game_id,
        userId: data.user_id,
        username: data.username,
        amount: data.amount,
        totalBuyIn: data.total_buyin || 0,
        type: data.type,
        handCount: data.hand_count || undefined,
        pointsPerHand: data.points_per_hand || undefined,
        createdAt: data.created_at
    };
}

export async function getPending(gameId: string): Promise<PendingBuyinRequest[]> {
    const { data, error } = await supabase
        .from('pending_buyins')
        .select()
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

    if (error) return [];

    return data.map(item => ({
        id: item.id,
        gameId: item.game_id,
        userId: item.user_id,
        username: item.username,
        amount: item.amount,
        totalBuyIn: item.total_buyin || 0,
        type: item.type,
        handCount: item.hand_count || undefined,
        pointsPerHand: item.points_per_hand || undefined,
        createdAt: item.created_at
    }));
}

export async function removePending(id: string): Promise<PendingBuyinRequest | null> {
    const { data, error } = await supabase
        .from('pending_buyins')
        .delete()
        .eq('id', id)
        .select()
        .single();

    if (error || !data) return null;

    return {
        id: data.id,
        gameId: data.game_id,
        userId: data.user_id,
        username: data.username,
        amount: data.amount,
        totalBuyIn: data.total_buyin || 0,
        type: data.type,
        handCount: data.hand_count || undefined,
        pointsPerHand: data.points_per_hand || undefined,
        createdAt: data.created_at
    };
}
