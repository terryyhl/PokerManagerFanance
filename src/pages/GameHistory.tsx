import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import { gamesApi, usersApi, Game } from '../lib/api';
import { useUser } from '../contexts/UserContext';

interface ThirteenHistoryItem {
    gameId: string;
    gameName: string;
    finishedAt: string;
    totalScore: number;
}

export default function GameHistory() {
    const navigate = useNavigate();
    const { user } = useUser();
    const listRef = useRef<HTMLDivElement>(null);
    const hasAnimated = useRef(false);

    const [tab, setTab] = useState<'normal' | 'thirteen'>('normal');

    // 普通房间
    const [games, setGames] = useState<Game[]>([]);
    const [isLoadingNormal, setIsLoadingNormal] = useState(true);
    const [errorNormal, setErrorNormal] = useState('');

    // 13水
    const [thirteenHistory, setThirteenHistory] = useState<ThirteenHistoryItem[]>([]);
    const [isLoadingThirteen, setIsLoadingThirteen] = useState(true);
    const [errorThirteen, setErrorThirteen] = useState('');

    const fetchNormal = async () => {
        if (!user) return;
        setIsLoadingNormal(true);
        setErrorNormal('');
        try {
            const { games } = await gamesApi.history(user.id);
            setGames(games);
        } catch (err: any) {
            setErrorNormal(err.message || '加载失败');
        } finally {
            setIsLoadingNormal(false);
        }
    };

    const fetchThirteen = async () => {
        if (!user) return;
        setIsLoadingThirteen(true);
        setErrorThirteen('');
        try {
            const { history } = await usersApi.getThirteenHistory(user.id);
            setThirteenHistory(history);
        } catch (err: any) {
            setErrorThirteen(err.message || '加载失败');
        } finally {
            setIsLoadingThirteen(false);
        }
    };

    useEffect(() => {
        fetchNormal();
        fetchThirteen();
    }, []);

    // 入场动画
    useEffect(() => {
        if (tab === 'normal' && !isLoadingNormal && games.length > 0) {
            runAnime();
        } else if (tab === 'thirteen' && !isLoadingThirteen && thirteenHistory.length > 0) {
            runAnime();
        }
    }, [tab, isLoadingNormal, isLoadingThirteen, games.length, thirteenHistory.length]);

    const runAnime = () => {
        if (!listRef.current) return;
        hasAnimated.current = true;
        anime({
            targets: listRef.current.children,
            translateY: [20, 0],
            opacity: [0, 1],
            duration: 400,
            easing: 'easeOutExpo',
            delay: anime.stagger(60),
        });
    };

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

    const isLoading = tab === 'normal' ? isLoadingNormal : isLoadingThirteen;
    const error = tab === 'normal' ? errorNormal : errorThirteen;
    const fetchCurrent = tab === 'normal' ? fetchNormal : fetchThirteen;

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="flex-shrink-0 px-5 pt-8 pb-3 bg-background-light dark:bg-background-dark z-10 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold leading-tight tracking-tight">牌局回顾</h2>
                    <button onClick={fetchCurrent}
                        className="flex items-center justify-center size-9 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">refresh</span>
                    </button>
                </div>

                {/* 选项卡 */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <button onClick={() => setTab('normal')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'normal'
                            ? 'bg-white dark:bg-[#1a2632] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'}`}>
                        普通房间
                    </button>
                    <button onClick={() => setTab('thirteen')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'thirteen'
                            ? 'bg-white dark:bg-[#1a2632] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'}`}>
                        十三水
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 pb-20">
                {/* Loading */}
                {isLoading && (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">wifi_off</span>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{error}</p>
                        <button onClick={fetchCurrent} className="text-primary text-sm font-medium hover:underline">重试</button>
                    </div>
                )}

                {/* 普通房间列表 */}
                {tab === 'normal' && !isLoading && !error && (
                    games.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">history</span>
                            <p className="text-slate-500 dark:text-slate-400 text-base font-medium mb-1">暂无牌局</p>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">完成结算后的牌局会显示在这里</p>
                        </div>
                    ) : (
                        <div ref={listRef} className="flex flex-col gap-3">
                            {games.map(game => (
                                <div key={game.id} onClick={() => navigate(`/settlement/${game.id}`)}
                                    className="opacity-0 cursor-pointer rounded-xl bg-white dark:bg-[#1a2632] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-primary/40 transition-all active:scale-[0.99] p-4">
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
                            ))}
                        </div>
                    )
                )}

                {/* 13水列表 */}
                {tab === 'thirteen' && !isLoading && !error && (
                    thirteenHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">playing_cards</span>
                            <p className="text-slate-500 dark:text-slate-400 text-base font-medium mb-1">暂无十三水牌局</p>
                            <p className="text-slate-400 dark:text-slate-500 text-sm">完成结算后的牌局会显示在这里</p>
                        </div>
                    ) : (
                        <div ref={listRef} className="flex flex-col gap-3">
                            {thirteenHistory.map((h, i) => (
                                <div key={`${h.gameId}-${i}`}
                                    className="opacity-0 cursor-pointer rounded-xl bg-white dark:bg-[#1a2632] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-violet-400/40 transition-all active:scale-[0.99] p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-base truncate mb-0.5">{h.gameName}</h4>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(h.finishedAt)}</p>
                                        </div>
                                        <div className={`text-lg font-black ${h.totalScore > 0 ? 'text-green-500' : h.totalScore < 0 ? 'text-red-500' : 'text-amber-400'}`}>
                                            {h.totalScore > 0 ? '+' : ''}{h.totalScore} 分
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
