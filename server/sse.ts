import { Response } from 'express';

export interface SSEClient {
    res: Response;
    gameId: string;
    userId: string;
    isHost: boolean;
}

// gameId → Set of connected clients
const rooms = new Map<string, Set<SSEClient>>();

export function addClient(client: SSEClient): void {
    if (!rooms.has(client.gameId)) rooms.set(client.gameId, new Set());
    rooms.get(client.gameId)!.add(client);
    console.log(`[SSE] +client game=${client.gameId} user=${client.userId} host=${client.isHost} total=${rooms.get(client.gameId)!.size}`);
}

export function removeClient(client: SSEClient): void {
    rooms.get(client.gameId)?.delete(client);
    console.log(`[SSE] -client game=${client.gameId} user=${client.userId} remaining=${rooms.get(client.gameId)?.size ?? 0}`);
}

function send(client: SSEClient, event: string, data: unknown): void {
    try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
        // Client disconnected
    }
}

/** 广播给房间内所有用户 */
export function broadcastToGame(gameId: string, event: string, data: unknown = {}): void {
    const room = rooms.get(gameId);
    if (!room) return;
    for (const client of room) send(client, event, data);
}

/** 只通知房主 */
export function notifyHost(gameId: string, event: string, data: unknown = {}): void {
    const room = rooms.get(gameId);
    if (!room) return;
    for (const client of room) {
        if (client.isHost) send(client, event, data);
    }
}

/** 广播给大厅所有用户 */
export function broadcastToLobby(event: string, data: unknown = {}): void {
    broadcastToGame('lobby', event, data);
}

/** 只通知特定用户 */
export function notifyUser(gameId: string, targetUserId: string, event: string, data: unknown = {}): void {
    const room = rooms.get(gameId);
    if (!room) return;
    for (const client of room) {
        if (client.userId === targetUserId) send(client, event, data);
    }
}
