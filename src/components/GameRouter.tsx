import React, { useState, useEffect } from 'react';
import { gamesApi, RoomType } from '../lib/api';
import GameRoom from '../pages/GameRoom';
import ThirteenWaterRoom from '../pages/ThirteenWaterRoom';
import TableErrorBoundary from './TableErrorBoundary';

interface GameRouterProps {
  forcedId: string;
}

/**
 * 根据房间类型（texas / thirteen）渲染对应的游戏房间组件。
 * 首次加载时向后端查询 room_type，然后缓存结果。
 */
export default function GameRouter({ forcedId }: GameRouterProps) {
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await gamesApi.get(forcedId);
        if (!cancelled) {
          setRoomType(res.game.room_type || 'texas');
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [forcedId]);

  if (error) {
    // GameRoom 内部已有错误处理，直接交给 GameRoom
    return <GameRoom forcedId={forcedId} />;
  }

  if (!roomType) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (roomType === 'thirteen') {
    return <TableErrorBoundary><ThirteenWaterRoom forcedId={forcedId} /></TableErrorBoundary>;
  }

  return <GameRoom forcedId={forcedId} />;
}
