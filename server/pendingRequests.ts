import { v4 as uuidv4 } from 'uuid';

export interface PendingBuyinRequest {
    id: string;
    gameId: string;
    userId: string;
    username: string;
    amount: number;
    type: 'initial' | 'rebuy';
    createdAt: string;
}

// gameId → PendingBuyinRequest[]
const store = new Map<string, PendingBuyinRequest[]>();

export function addPending(req: Omit<PendingBuyinRequest, 'id' | 'createdAt'>): PendingBuyinRequest {
    const item: PendingBuyinRequest = {
        ...req,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
    };
    if (!store.has(req.gameId)) store.set(req.gameId, []);
    store.get(req.gameId)!.push(item);
    return item;
}

export function getPending(gameId: string): PendingBuyinRequest[] {
    return store.get(gameId) ?? [];
}

export function removePending(id: string): PendingBuyinRequest | null {
    for (const [gameId, list] of store) {
        const idx = list.findIndex(r => r.id === id);
        if (idx >= 0) {
            const [removed] = list.splice(idx, 1);
            store.set(gameId, list);
            return removed;
        }
    }
    return null;
}
