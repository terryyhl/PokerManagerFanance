import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/AnimatedPage';
import { useUser } from '../contexts/UserContext';
import { usersApi, LuckyHandHistory as LuckyHandHistoryType } from '../lib/api';
import PokerCardDisp from '../components/PokerCardDisp';

export default function LuckyHandHistory() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [luckyHands, setLuckyHands] = useState<LuckyHandHistoryType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const { luckyHands: data } = await usersApi.getLuckyHandsHistory(user.id);
                setLuckyHands(data);
            } catch (err) {
                console.error('Failed to load lucky hands history:', err);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, navigate]);

    // Group by game
    interface GameGroup {
        gameName: string;
        blindLevel: string;
        finishedAt: string;
        hands: LuckyHandHistoryType[];
    }

    const gameGroupsMap = new Map<string, GameGroup>();
    for (const lh of luckyHands) {
        const gameId = lh.game_id;
        if (!gameGroupsMap.has(gameId)) {
            const game = lh.games as Record<string, unknown> | undefined;
            gameGroupsMap.set(gameId, {
                gameName: (game?.name as string) || '未知房间',
                blindLevel: (game?.blind_level as string) || '?',
                finishedAt: (game?.finished_at as string) || (game?.created_at as string) || lh.created_at,
                hands: [],
            });
        }
        gameGroupsMap.get(gameId)!.hands.push(lh);
    }

    // Sort groups by date descending
    const sortedGroups = [...gameGroupsMap.entries()].sort((a, b) =>
        new Date(b[1].finishedAt).getTime() - new Date(a[1].finishedAt).getTime()
    );

    // Total hit count
    const totalHits = luckyHands.reduce((sum, lh) => sum + lh.hit_count, 0);

    if (!user) return null;

    return (
        <AnimatedPage animationType="slide-left">
            <div className="relative flex h-full min-h-full w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

                {/* Header */}
                <div className="flex items-center gap-3 p-5 pt-8 bg-background-light dark:bg-background-dark sticky top-0 z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center size-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-bold">历史幸运手牌</h2>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-10">

                    {/* Summary */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-800/30">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                                <span className="material-symbols-outlined text-[16px]">playing_cards</span>
                                <span className="text-xs font-bold uppercase tracking-wider">总手牌数</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? '-' : luckyHands.length}</p>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-800/30">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                                <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                                <span className="text-xs font-bold uppercase tracking-wider">总命中次数</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? '-' : totalHits}</p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-500 text-sm">
                            <span className="material-symbols-outlined text-[18px]">error_outline</span>
                            数据加载失败
                        </div>
                    )}

                    {/* Loading */}
                    {isLoading ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                            ))}
                        </div>
                    ) : luckyHands.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-[#1a2632] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3">playing_cards</span>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">暂无幸运手牌记录</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {sortedGroups.map(([gameId, group]) => (
                                <div key={gameId} className="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                                    {/* Game header */}
                                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
                                        <h4 className="font-bold text-slate-900 dark:text-white text-base">{group.gameName}</h4>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                            {new Date(group.finishedAt).toLocaleDateString('zh-CN')} • 盲注 {group.blindLevel}
                                        </p>
                                    </div>

                                    {/* Hands list */}
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {group.hands
                                            .sort((a, b) => a.hand_index - b.hand_index)
                                            .map(lh => (
                                                <div key={lh.id} className="px-4 py-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center size-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs">
                                                            #{lh.hand_index}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <PokerCardDisp card={lh.card_1} />
                                                            <PokerCardDisp card={lh.card_2} />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-amber-500 text-[16px]">local_fire_department</span>
                                                        <span className={`text-sm font-black ${lh.hit_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                            {lh.hit_count} 次命中
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
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
