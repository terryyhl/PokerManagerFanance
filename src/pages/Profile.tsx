import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/AnimatedPage';
import { useUser } from '../contexts/UserContext';
import { usersApi } from '../lib/api';
import Avatar from '../components/Avatar';

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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchProfileData = async () => {
            try {
                const { stats: userStats, history: userHistory } = await usersApi.getStats(user.id);
                setStats(userStats);
                setHistory(userHistory);
            } catch (err) {
                console.error('Failed to load profile data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [user, navigate]);

    if (!user) return null;

    return (
        <AnimatedPage animationType="slide-left">
            <div className="relative flex h-full min-h-full w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 pb-20">

                {/* Header */}
                <div className="flex items-center justify-between p-5 pt-8 bg-background-light dark:bg-background-dark sticky top-0 z-10 transition-all">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold">个人中心</h2>
                    </div>
                    <button
                        onClick={() => {
                            if (window.confirm('确定要退出登录吗？')) {
                                logout();
                                navigate('/login');
                            }
                        }}
                        className="flex items-center justify-center size-9 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="退出登录"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-6">

                    {/* User Hero */}
                    <div className="flex flex-col items-center mt-4 mb-8">
                        <div className="size-24 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative ring-4 ring-primary/20 mb-4">
                            <Avatar username={user.username} />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{user.username}</h1>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
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
