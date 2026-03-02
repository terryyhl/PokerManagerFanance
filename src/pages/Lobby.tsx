import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi, Game } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';

export default function Lobby() {
  const navigate = useNavigate();
  const { user } = useUser();
  const listRef = useRef<HTMLDivElement>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchGames = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setIsRefreshing(true);
    }
    setError('');
    try {
      const { games } = await gamesApi.list();
      setGames(games);
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      if (!silent) setError(err instanceof Error ? err.message : '加载游戏列表失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // 监听 games 表变化，有新房间创建/关闭时自动刷新
  useEffect(() => {
    const channel = supabase
      .channel('lobby:games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        fetchGames(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players' }, () => {
        fetchGames(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGames]);

  useEffect(() => {
    if (!isLoading && games.length > 0 && listRef.current) {
      anime({
        targets: listRef.current.children,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutExpo',
        delay: anime.stagger(100)
      });
    }
  }, [refreshKey, isLoading, games.length]);

  const getPlayerCount = (game: Game): string | number => {
    if (game.game_players && Array.isArray(game.game_players)) {
      const countObj = game.game_players[0] as { count?: number } | undefined;
      return countObj?.count ?? '?';
    }
    return '?';
  };

  return (
    <AnimatedPage animationType="slide-left">
      <div className="relative flex h-full min-h-full w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between p-5 pt-8 bg-background-light dark:bg-background-dark sticky top-0 z-10">
          <h2 className="text-2xl font-bold leading-tight tracking-[-0.015em]">大厅</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/leaderboard')}
              className="flex items-center justify-center size-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="排行榜"
            >
              <span className="material-symbols-outlined text-[20px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </button>
            <button
              onClick={() => fetchGames()}
              disabled={isRefreshing}
              className="flex items-center justify-center size-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
            </button>
            <button
              onClick={() => navigate('/create')}
              className="bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="text-sm font-bold">创建</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-24">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h3 className="text-lg font-bold">活跃牌局</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isLoading ? '加载中...' : `${games.length} 进行中`}
            </span>
          </div>

          {isLoading && (
            <div className="flex flex-col gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">wifi_off</span>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{error}</p>
              <button onClick={() => fetchGames()} className="text-primary text-sm font-medium hover:underline">重试</button>
            </div>
          )}

          {!isLoading && !error && games.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">playing_cards</span>
              <p className="text-slate-500 dark:text-slate-400 text-base font-medium mb-2">暂无活跃牌局</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mb-6">点击"创建"开始一局新游戏</p>
              <button
                onClick={() => navigate('/create')}
                className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md shadow-primary/20"
              >
                创建牌局
              </button>
            </div>
          )}

          {!isLoading && !error && games.length > 0 && (
            <div ref={listRef}>
              {games.map((game) => (
                <div key={game.id} className="mb-4 flex flex-col rounded-xl bg-white dark:bg-[#1a2632] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden opacity-0">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">{game.name}</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">德州扑克 . 盲注 {game.blind_level}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-primary text-base">payments</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{game.blind_level} 积分</span>
                          </div>
                          <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-slate-400 text-base">group</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{getPlayerCount(game)} 人</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">最低买入</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{game.min_buyin} 积分</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">进行中</span>
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                        密码房间
                      </span>
                      {game.insurance_mode && (
                        <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded">
                          <span className="material-symbols-outlined text-[12px]">verified_user</span>
                          带入审核
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/game/${game.id}`)}
                        className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <span>进入牌局</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="absolute bottom-16 left-0 right-0 p-4 bg-background-light dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 pb-safe">
          <button
            onClick={() => navigate('/join')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors text-sm font-medium mb-4"
          >
            <span className="material-symbols-outlined text-[20px]">lock_open</span>
            输入密码加入私密房间
          </button>
        </div>
      </div>
    </AnimatedPage>
  );
}
