import { supabase } from './supabase.js';

export interface PendingBuyinRequest {
    id: string;
    gameId: string;
    userId: string;
    username: string;
    amount: number;
    type: 'initial' | 'rebuy';
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
            type: req.type
        })
        .select()
        .single();

    if (error) {
        console.error('[pendingRequests] addPending error:', error);
        throw new Error(`数据库错误: ${error.message} (代码: ${error.code})`);
    }

    return {
        id: data.id,
        gameId: data.game_id,
        userId: data.user_id,
        username: data.username,
        amount: data.amount,
        type: data.type,
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
        type: item.type,
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
        type: data.type,
        createdAt: data.created_at
    };
}
