import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/AnimatedPage';
import { useUser } from '../contexts/UserContext';
import { usersApi, LuckyHandHistory } from '../lib/api';
import Avatar from '../components/Avatar';
import HandComboDisp from '../components/HandComboDisp';

interface UserStats {
    totalGames: number;
    totalProfit: number;
    totalBuyIn: number;
    winRate: number;
}

interface GameHistoryItem {
    gameId: string;
    gameName: string;
    blindLevel: string;
    finishedAt: string;
    profit: number;
    finalChips: number;
    totalBuyIn: number;
}

export default function Profile() {
    const navigate = useNavigate();
    const { user, logout } = useUser();
    const [stats, setStats] = useState<UserStats>({ totalGames: 0, totalProfit: 0, totalBuyIn: 0, winRate: 0 });
    const [history, setHistory] = useState<GameHistoryItem[]>([]);
    const [luckyHands, setLuckyHands] = useState<LuckyHandHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchProfileData = async () => {
            try {
                const [statsResult, luckyResult] = await Promise.all([
                    usersApi.getStats(user.id),
                    usersApi.getLuckyHandsHistory(user.id),
                ]);
                setStats(statsResult.stats);
                setHistory(statsResult.history);
                setLuckyHands(luckyResult.luckyHands);
            } catch (err) {
                console.error('Failed to load profile data:', err);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [user, navigate]);

    // Top 3 lucky hands by hit_count (already sorted from backend), filter out 0 hits
    const topLuckyHands = luckyHands.filter(lh => lh.hit_count > 0).slice(0, 3);

    if (!user) return null;

    return (
        <AnimatedPage animationType="slide-left">
            <div className="flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

                {/* Header — 固定在顶部，不参与滚动 */}
                <div className="flex-shrink-0 flex items-center justify-between p-5 pt-8 bg-background-light dark:bg-background-dark z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold">个人中心</h2>
                    </div>
                    {showLogoutConfirm ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">确定退出？</span>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => { logout(); navigate('/login'); }}
                                className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                退出
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="flex items-center justify-center size-9 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            aria-label="退出登录"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-20">

                    {/* User Hero — 紧凑横向布局 */}
                    <div className="flex items-center gap-4 mb-5">
                        <div className="size-14 rounded-full border-2 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-primary/20 flex-shrink-0">
                            <Avatar username={user.username} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">{user.username}</h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}</p>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-500 text-sm">
                            <span className="material-symbols-outlined text-[18px]">error_outline</span>
                            数据加载失败，部分内容可能不准确
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-2">
                                <span className="material-symbols-outlined text-[16px]">sports_esports</span>
                                <span className="text-xs font-bold uppercase tracking-wider">总场次</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? '-' : stats.totalGames}</p>
                        </div>

                        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-2">
                                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
                                <span className="text-xs font-bold uppercase tracking-wider">胜率</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? '-' : `${stats.winRate}%`}</p>
                        </div>

                        <div className="bg-gradient-to-br from-primary/10 to-blue-500/5 dark:from-primary/20 dark:to-blue-900/20 p-4 rounded-2xl shadow-sm border border-primary/20 flex flex-col justify-between col-span-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5 text-primary">
                                    <span className="material-symbols-outlined text-[16px]">payments</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">生涯总盈亏</span>
                                </div>
                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800">
                                    总买入 {isLoading ? '-' : stats.totalBuyIn} 积分
                                </div>
                            </div>
                            <p className={`text-4xl font-black tracking-tighter mt-1 ${stats.totalProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                {isLoading ? '-' : `${stats.totalProfit > 0 ? '+' : ''}${stats.totalProfit} 积分`}
                            </p>
                        </div>
                    </div>

                    {/* Lucky Hands Top 3 */}
                    {!isLoading && topLuckyHands.length > 0 && (
                        <div className="mb-5">
                            <div
                                className="flex items-center justify-between mb-4 cursor-pointer group"
                                onClick={() => navigate('/lucky-history')}
                            >
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500">star</span>
                                    历史幸运手牌
                                </h3>
                                <div className="flex items-center gap-1 text-sm font-medium text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">
                                    <span>全部记录</span>
                                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {topLuckyHands.map((lh, i) => (
                                    <div
                                        key={lh.id}
                                        className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center size-8 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 font-black text-sm">
                                                {i + 1}
                                            </div>
                                            <HandComboDisp combo={lh.card_1} card2={lh.card_2} compact />
                                            <div className="ml-1">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {(lh.games as Record<string, unknown>)?.name as string || '未知房间'}
                                                </p>
                                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                    {new Date(lh.created_at).toLocaleDateString('zh-CN')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full">
                                            <span className="material-symbols-outlined text-amber-500 text-[16px]">local_fire_department</span>
                                            <span className="text-sm font-black text-amber-600 dark:text-amber-400">{lh.hit_count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent History */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">history</span>
                            牌局回顾
                        </h3>

                        {isLoading ? (
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />)}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-[#1a2632] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">history_toggle_off</span>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">暂无牌局回顾数据</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {history.map((h, i) => (
                                    <div key={`${h.gameId}-${i}`} className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer" onClick={() => navigate(`/settlement/${h.gameId}`)}>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">{h.gameName}</h4>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                {new Date(h.finishedAt).toLocaleDateString('zh-CN')} • 盲注 {h.blindLevel}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${h.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                                {h.profit > 0 ? '+' : ''}{h.profit} 积分
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">买入 {h.totalBuyIn} 积分</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </AnimatedPage>
    );
}
