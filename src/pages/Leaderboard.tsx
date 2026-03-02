import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, LeaderboardEntry } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';

type SortKey = 'totalProfit' | 'totalGames' | 'winRate' | 'biggestWin';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'totalProfit', label: '总盈亏' },
    { key: 'totalGames', label: '场次' },
    { key: 'winRate', label: '胜率' },
    { key: 'biggestWin', label: '最大赢' },
];

export default function Leaderboard() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('totalProfit');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await usersApi.getLeaderboard();
                if (!cancelled) setData(res.leaderboard);
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const sorted = [...data].sort((a, b) => {
        if (sortKey === 'totalProfit') return b.totalProfit - a.totalProfit;
        if (sortKey === 'totalGames') return b.totalGames - a.totalGames;
        if (sortKey === 'winRate') return b.winRate - a.winRate;
        if (sortKey === 'biggestWin') return b.biggestWin - a.biggestWin;
        return 0;
    });

    const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#151f2b]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center px-4 h-14">
                    <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                    </button>
                    <h1 className="text-lg font-bold flex-1">排行榜</h1>
                    <span className="material-symbols-outlined text-[24px] text-amber-500">emoji_events</span>
                </div>
            </div>

            {/* 排序选项 */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                {SORT_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setSortKey(opt.key)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            sortKey === opt.key
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* 内容 */}
            <div className="px-4 pb-24">
                {isLoading ? (
                    <div className="space-y-3 mt-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-red-500 text-sm">{error}</div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">还没有对局数据</div>
                ) : (
                    <div className="space-y-3 mt-1">
                        {sorted.map((entry, idx) => {
                            const rank = idx + 1;
                            const isMe = entry.userId === user?.id;
                            const profitColor = entry.totalProfit > 0
                                ? 'text-emerald-500'
                                : entry.totalProfit < 0
                                    ? 'text-red-500'
                                    : 'text-slate-400';

                            return (
                                <div
                                    key={entry.userId}
                                    className={`relative rounded-2xl p-4 transition-all ${
                                        isMe
                                            ? 'bg-primary/5 border-2 border-primary/30 dark:bg-primary/10'
                                            : 'bg-white dark:bg-[#1a2632] border border-slate-100 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* 排名 */}
                                        <div className="w-8 text-center flex-shrink-0">
                                            {rank <= 3 ? (
                                                <span className={`material-symbols-outlined text-[28px] ${medalColors[rank - 1]}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                                    emoji_events
                                                </span>
                                            ) : (
                                                <span className="text-lg font-black text-slate-300 dark:text-slate-600">{rank}</span>
                                            )}
                                        </div>

                                        {/* 头像 + 名字 */}
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <Avatar username={entry.username} size={36} />
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm truncate">
                                                    {entry.username}
                                                    {isMe && <span className="text-primary text-xs ml-1">(我)</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {entry.totalGames}场 · 胜率{entry.winRate}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* 主数据 */}
                                        <div className="text-right flex-shrink-0">
                                            {sortKey === 'totalProfit' && (
                                                <span className={`text-xl font-black ${profitColor}`}>
                                                    {entry.totalProfit > 0 ? '+' : ''}{entry.totalProfit}
                                                </span>
                                            )}
                                            {sortKey === 'totalGames' && (
                                                <span className="text-xl font-black text-primary">{entry.totalGames}</span>
                                            )}
                                            {sortKey === 'winRate' && (
                                                <span className="text-xl font-black text-primary">{entry.winRate}%</span>
                                            )}
                                            {sortKey === 'biggestWin' && (
                                                <span className="text-xl font-black text-emerald-500">+{entry.biggestWin}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 详细数据行 */}
                                    <div className="flex items-center gap-4 mt-2.5 ml-11 text-[10px] text-slate-400">
                                        <span>总盈亏 <b className={profitColor}>{entry.totalProfit > 0 ? '+' : ''}{entry.totalProfit}</b></span>
                                        <span>总买入 <b>{entry.totalBuyIn}</b></span>
                                        <span>场均 <b className={entry.avgProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}>{entry.avgProfit > 0 ? '+' : ''}{entry.avgProfit}</b></span>
                                        {entry.biggestLoss < 0 && <span>最大亏 <b className="text-red-500">{entry.biggestLoss}</b></span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
