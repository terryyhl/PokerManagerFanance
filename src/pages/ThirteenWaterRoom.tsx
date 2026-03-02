import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, Game, Player } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';

interface ThirteenWaterRoomProps {
  forcedId: string;
}

/**
 * 十三水游戏房间
 * Phase 1: 骨架 — 房间信息展示 + 玩家列表 + 等待开始
 */
export default function ThirteenWaterRoom({ forcedId }: ThirteenWaterRoomProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const id = forcedId;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchGame = useCallback(async () => {
    if (!id) return;
    try {
      const res = await gamesApi.get(id);
      setGame(res.game);
      setPlayers(res.players);
    } catch {
      showToast('加载房间失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const isHost = user?.id === game?.created_by;
  const maxPlayers = game?.thirteen_max_players || 4;
  const currentPlayers = players.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center gap-4 text-slate-500">
        <span className="material-symbols-outlined text-5xl">error</span>
        <p>房间不存在</p>
        <button onClick={() => navigate('/lobby')} className="text-primary font-bold">返回大厅</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 flex flex-col">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#151f2b]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => navigate('/lobby')} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{game.name}</h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="bg-purple-500/20 text-purple-500 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold">🀄 十三水</span>
              <span>底分 {game.thirteen_base_score || 1}</span>
              <span>·</span>
              <span>{game.thirteen_ghost_count || 6}张鬼牌</span>
              {game.thirteen_compare_suit && <span>· ♠比花色</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="material-symbols-outlined text-base">tag</span>
            <span className="font-mono font-bold">{game.room_code}</span>
          </div>
        </div>
      </div>

      {/* ─── 玩家区域 ─── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">
            玩家 ({currentPlayers}/{maxPlayers})
          </h3>
          {currentPlayers < maxPlayers && (
            <span className="text-xs text-amber-500 font-medium animate-pulse">等待玩家加入...</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {players.map(player => {
            const isMe = player.user_id === user?.id;
            const isPlayerHost = player.user_id === game.created_by;
            return (
              <div
                key={player.id}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  isMe
                    ? 'bg-primary/5 border-primary/30 dark:bg-primary/10'
                    : 'bg-white dark:bg-[#1a2632] border-slate-100 dark:border-slate-800'
                }`}
              >
                <Avatar username={player.users?.username || '?'} isAdmin={isPlayerHost} className="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">
                    {player.users?.username || '?'}
                    {isMe && <span className="text-primary text-xs ml-1">(我)</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isPlayerHost ? '房主' : '玩家'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-300 dark:text-slate-600">0</span>
                  <p className="text-[9px] text-slate-400">总分</p>
                </div>
              </div>
            );
          })}
          {/* 空位 */}
          {Array.from({ length: maxPlayers - currentPlayers }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center justify-center p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 min-h-[72px]">
              <span className="text-slate-300 dark:text-slate-600 text-sm">空位</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 游戏区域（骨架占位） ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4">
        <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <span className="text-4xl">🀄</span>
        </div>
        <p className="text-slate-400 text-sm text-center">
          {currentPlayers < 2
            ? '至少需要 2 名玩家才能开始'
            : isHost
              ? '点击下方按钮开始新一局'
              : '等待房主开始游戏...'
          }
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">倒计时 {game.thirteen_time_limit || 90}s</span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">底分 {game.thirteen_base_score || 1}</span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">鬼牌 {game.thirteen_ghost_count || 6}张</span>
        </div>
      </div>

      {/* ─── 底部操作 ─── */}
      {isHost && currentPlayers >= 2 && (
        <div className="p-4 bg-background-light dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 pb-8">
          <button
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-lg shadow-purple-600/25 transition-all active:scale-[0.98]"
            onClick={() => showToast('开始新一局功能开发中...', 'info')}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            开始新一局
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
