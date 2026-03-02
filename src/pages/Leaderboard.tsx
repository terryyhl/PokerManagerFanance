import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, timerApi, LeaderboardEntry, InteractionLeaderboardEntry } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';

// ───────────────── 战绩排行 ─────────────────

type StatsSortKey = 'totalProfit' | 'totalGames' | 'winRate' | 'biggestWin';

const STATS_SORT_OPTIONS: { key: StatsSortKey; label: string }[] = [
    { key: 'totalProfit', label: '总盈亏' },
    { key: 'totalGames', label: '场次' },
    { key: 'winRate', label: '胜率' },
    { key: 'biggestWin', label: '最大赢' },
];

// ───────────────── 趣味互动 ─────────────────

type InteractionSortKey = 'totalInteractions' | 'timerCount' | 'eggCount' | 'chickenCount' | 'flowerCount';

const INTERACTION_SORT_OPTIONS: { key: InteractionSortKey; label: string; emoji: string }[] = [
    { key: 'totalInteractions', label: '总互动', emoji: '🎯' },
    { key: 'timerCount', label: '被催促', emoji: '⏱️' },
    { key: 'eggCount', label: '被砸蛋', emoji: '🥚' },
    { key: 'chickenCount', label: '被抓鸡', emoji: '🐔' },
    { key: 'flowerCount', label: '收鲜花', emoji: '🌹' },
];

type Tab = 'stats' | 'interaction';

export default function Leaderboard() {
    const navigate = useNavigate();
    const { user } = useUser();
    const [tab, setTab] = useState<Tab>('stats');

    // 战绩数据
    const [statsData, setStatsData] = useState<LeaderboardEntry[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState('');
    const [statsSortKey, setStatsSortKey] = useState<StatsSortKey>('totalProfit');

    // 互动数据
    const [interactionData, setInteractionData] = useState<InteractionLeaderboardEntry[]>([]);
    const [interactionLoading, setInteractionLoading] = useState(true);
    const [interactionError, setInteractionError] = useState('');
    const [interactionSortKey, setInteractionSortKey] = useState<InteractionSortKey>('totalInteractions');

    // 加载战绩
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await usersApi.getLeaderboard();
                if (!cancelled) setStatsData(res.leaderboard);
            } catch (e) {
                if (!cancelled) setStatsError((e as Error).message);
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // 加载互动
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await timerApi.getLeaderboard();
                if (!cancelled) setInteractionData(res.leaderboard);
            } catch (e) {
                if (!cancelled) setInteractionError((e as Error).message);
            } finally {
                if (!cancelled) setInteractionLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // 战绩排序
    const sortedStats = [...statsData].sort((a, b) => {
        if (statsSortKey === 'totalProfit') return b.totalProfit - a.totalProfit;
        if (statsSortKey === 'totalGames') return b.totalGames - a.totalGames;
        if (statsSortKey === 'winRate') return b.winRate - a.winRate;
        if (statsSortKey === 'biggestWin') return b.biggestWin - a.biggestWin;
        return 0;
    });

    // 互动排序
    const sortedInteraction = [...interactionData].sort((a, b) => {
        return (b[interactionSortKey] as number) - (a[interactionSortKey] as number);
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

                {/* 顶级 Tab 切换 */}
                <div className="flex px-4 gap-1">
                    <button
                        onClick={() => setTab('stats')}
                        className={`flex-1 py-2 text-sm font-bold text-center border-b-2 transition-all ${
                            tab === 'stats'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        战绩排行
                    </button>
                    <button
                        onClick={() => setTab('interaction')}
                        className={`flex-1 py-2 text-sm font-bold text-center border-b-2 transition-all ${
                            tab === 'interaction'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        趣味互动
                    </button>
                </div>
            </div>

            {tab === 'stats' ? (
                <>
                    {/* 战绩排序选项 */}
                    <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                        {STATS_SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setStatsSortKey(opt.key)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                    statsSortKey === opt.key
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* 战绩内容 */}
                    <div className="px-4 pb-24">
                        {statsLoading ? (
                            <div className="space-y-3 mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                ))}
                            </div>
                        ) : statsError ? (
                            <div className="text-center py-12 text-red-500 text-sm">{statsError}</div>
                        ) : sortedStats.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">还没有对局数据</div>
                        ) : (
                            <div className="space-y-3 mt-1">
                                {sortedStats.map((entry, idx) => {
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
                                                    {statsSortKey === 'totalProfit' && (
                                                        <span className={`text-xl font-black ${profitColor}`}>
                                                            {entry.totalProfit > 0 ? '+' : ''}{entry.totalProfit}
                                                        </span>
                                                    )}
                                                    {statsSortKey === 'totalGames' && (
                                                        <span className="text-xl font-black text-primary">{entry.totalGames}</span>
                                                    )}
                                                    {statsSortKey === 'winRate' && (
                                                        <span className="text-xl font-black text-primary">{entry.winRate}%</span>
                                                    )}
                                                    {statsSortKey === 'biggestWin' && (
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
                </>
            ) : (
                <>
                    {/* 互动排序选项 */}
                    <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                        {INTERACTION_SORT_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setInteractionSortKey(opt.key)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                    interactionSortKey === opt.key
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                <span>{opt.emoji}</span>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* 互动内容 */}
                    <div className="px-4 pb-24">
                        {interactionLoading ? (
                            <div className="space-y-3 mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                ))}
                            </div>
                        ) : interactionError ? (
                            <div className="text-center py-12 text-red-500 text-sm">{interactionError}</div>
                        ) : sortedInteraction.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-sm">还没有互动数据</div>
                        ) : (
                            <div className="space-y-3 mt-1">
                                {sortedInteraction.map((entry, idx) => {
                                    const rank = idx + 1;
                                    const isMe = entry.userId === user?.id;

                                    // 当前排序维度对应的值
                                    const mainValue = entry[interactionSortKey] as number;
                                    const mainOpt = INTERACTION_SORT_OPTIONS.find(o => o.key === interactionSortKey)!;

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
                                                        <span className={`text-[24px] ${medalColors[rank - 1]}`}>
                                                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
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
                                                            共{entry.totalInteractions}次互动
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 主数据 */}
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-xl font-black text-primary">
                                                        {mainOpt.emoji} {mainValue}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 详细数据行 — emoji 计数条 */}
                                            <div className="flex items-center gap-4 mt-2.5 ml-11 text-[11px] text-slate-500 dark:text-slate-400">
                                                <span>⏱️ {entry.timerCount}</span>
                                                <span>🥚 {entry.eggCount}</span>
                                                <span>🐔 {entry.chickenCount}</span>
                                                <span>🌹 {entry.flowerCount}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
