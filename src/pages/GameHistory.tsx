import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi, Game } from '../lib/api';
import { useUser } from '../contexts/UserContext';

export default function GameHistory() {
    const navigate = useNavigate();
    const { user } = useUser();
    const listRef = useRef<HTMLDivElement>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchHistory = async () => {
        if (!user) return;
        setIsLoading(true);
        setError('');
        try {
            const { games } = await gamesApi.history(user.id);
            setGames(games);
        } catch (err: any) {
            setError(err.message || '加载牌局回顾失败');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    useEffect(() => {
        if (!isLoading && games.length > 0 && listRef.current) {
            anime({
                targets: listRef.current.children,
                translateY: [20, 0],
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutExpo',
                delay: anime.stagger(80),
            });
        }
    }, [isLoading, games.length]);

    const getPlayerCount = (game: Game) => {
        if (game.game_players && Array.isArray(game.game_players)) {
            const countObj = game.game_players[0] as any;
            return countObj?.count ?? '?';
        }
        return '?';
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleDateString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <AnimatedPage animationType="slide-left">
            <div className="relative flex h-full min-h-full w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-8 pb-4 bg-background-light dark:bg-background-dark sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold leading-tight tracking-tight">牌局回顾</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">仅显示你参与过的已完成牌局</p>
                    </div>
                    <button
                        onClick={fetchHistory}
                        className="flex items-center justify-center size-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">refresh</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* Loading skeletons */}
                    {isLoading && (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">wifi_off</span>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{error}</p>
                            <button onClick={fetchHistory} className="text-primary text-sm font-medium hover:underline">重试</button>
                        </div>
                    )}

                    {/* Empty */}
                    {!isLoading && !error && games.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">history</span>
                            <p className="text-slate-500 dark:text-slate-400 text-base font-medium mb-1">暂无牌局回顾</p>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">完成结算后的牌局会显示在这里</p>
                        </div>
                    )}

                    {/* Game list */}
                    {!isLoading && !error && games.length > 0 && (
                        <div ref={listRef} className="flex flex-col gap-3">
                            {games.map(game => (
                                <div
                                    key={game.id}
                                    onClick={() => navigate(`/settlement/${game.id}`)}
                                    className="opacity-0 cursor-pointer flex flex-col rounded-xl bg-white dark:bg-[#1a2632] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-primary/40 dark:hover:border-primary/40 transition-all active:scale-[0.99]"
                                >
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-base truncate mb-0.5">{game.name}</h4>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">盲注 {game.blind_level} · {getPlayerCount(game)} 人参与</p>
                                            </div>
                                            <span className="shrink-0 ml-3 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">已完成</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                <span>{formatDate(game.finished_at)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-primary font-medium">
                                                <span>查看结算</span>
                                                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AnimatedPage>
    );
}
