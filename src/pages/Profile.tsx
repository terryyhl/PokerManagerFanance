import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import AnimatedPage from '../components/AnimatedPage';
import { useUser } from '../contexts/UserContext';
import { usersApi, LuckyHandHistory, timerApi, gamesApi } from '../lib/api';
import Avatar from '../components/Avatar';
import HandComboDisp from '../components/HandComboDisp';

function getInitialDark(): boolean {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return document.documentElement.classList.contains('dark');
}

function applyTheme(dark: boolean) {
    if (dark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
}

interface UserStats {
    totalGames: number;
    totalProfit: number;
    totalBuyIn: number;
    winRate: number;
}

interface ThirteenStats {
    totalGames: number;
    totalRounds: number;
    totalScore: number;
    winRounds: number;
    winRate: number;
    gunCount: number;
    homerunCount: number;
}

export default function Profile() {
    const navigate = useNavigate();
    const { user, setUser, logout } = useUser();
    const [stats, setStats] = useState<UserStats>({ totalGames: 0, totalProfit: 0, totalBuyIn: 0, winRate: 0 });
    const [thirteenStats, setThirteenStats] = useState<ThirteenStats>({ totalGames: 0, totalRounds: 0, totalScore: 0, winRounds: 0, winRate: 0, gunCount: 0, homerunCount: 0 });
    const [luckyHands, setLuckyHands] = useState<LuckyHandHistory[]>([]);
    const [timerStats, setTimerStats] = useState<{
        timerCount: number; timerTotalSec: number; timerAvgSec: number; timerMaxSec: number;
        eggCount: number; chickenCount: number; flowerCount: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isDark, setIsDark] = useState(getInitialDark);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showQrShare, setShowQrShare] = useState(false);
    const [showRename, setShowRename] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [renameLoading, setRenameLoading] = useState(false);
    const [renameError, setRenameError] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }

        const fetchProfileData = async () => {
            try {
                const [statsResult, luckyResult, timerResult, twResult] = await Promise.all([
                    usersApi.getStats(user.id),
                    usersApi.getLuckyHandsHistory(user.id),
                    timerApi.getUserStats(user.id).catch(() => ({ stats: null })),
                    usersApi.getThirteenStats(user.id).catch(() => null),
                ]);
                setStats(statsResult.stats);
                setLuckyHands(luckyResult.luckyHands);
                if (timerResult.stats) setTimerStats(timerResult.stats);
                if (twResult) setThirteenStats(twResult);
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

    const handleToggleTheme = useCallback(() => {
        setIsDark(prev => {
            const next = !prev;
            applyTheme(next);
            return next;
        });
    }, []);

    const handleOpenRename = () => {
        if (!user) return;
        setNewUsername(user.username);
        setRenameError('');
        setShowRename(true);
    };

    const handleRename = async () => {
        if (!user) return;
        const trimmed = newUsername.trim();
        if (!trimmed) { setRenameError('用户名不能为空'); return; }
        if (trimmed.length > 20) { setRenameError('用户名不能超过20个字符'); return; }
        if (trimmed === user.username) { setShowRename(false); return; }

        setRenameLoading(true);
        setRenameError('');
        try {
            const res = await usersApi.updateUsername(user.id, trimmed);
            setUser({ ...user, username: res.user.username });
            setShowRename(false);
        } catch (err: any) {
            setRenameError(err.message || '修改失败，请重试');
        } finally {
            setRenameLoading(false);
        }
    };

    if (!user) return null;

    return (
        <AnimatedPage animationType="slide-left">
            <div className="flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

                {/* Header — 固定在顶部，不参与滚动 */}
                <div className="flex-shrink-0 flex items-center justify-between p-5 pt-8 bg-background-light dark:bg-background-dark z-10">
                    <h2 className="text-xl font-bold">个人中心</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleToggleTheme}
                            className="flex items-center justify-center size-9 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
                        >
                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {isDark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                        <button
                            onClick={() => setShowQrShare(true)}
                            className="flex items-center justify-center size-9 rounded-full text-primary hover:bg-primary/10 transition-colors"
                            aria-label="分享应用"
                        >
                            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                        </button>
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="flex items-center justify-center size-9 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            aria-label="退出登录"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-20">

                    {/* User Hero — 紧凑横向布局 */}
                    <div className="flex items-center gap-4 mb-5">
                        <div className="size-14 rounded-full border-2 border-white dark:border-slate-800 shadow-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-primary/20 flex-shrink-0">
                            <Avatar username={user.username} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">{user.username}</h1>
                                <button
                                    onClick={handleOpenRename}
                                    className="flex-shrink-0 flex items-center justify-center size-6 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                    aria-label="修改用户名"
                                >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                            </div>
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
                            {/* 合并总计 */}
                            {(() => {
                                const combined = stats.totalProfit + thirteenStats.totalScore;
                                return (
                                    <p className={`text-4xl font-black tracking-tighter mt-1 ${combined >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                        {isLoading ? '-' : `${combined > 0 ? '+' : ''}${combined} 积分`}
                                    </p>
                                );
                            })()}
                            {/* 德州/13水 明细 */}
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-primary/10 dark:border-blue-700/20">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">德州</span>
                                    <span className={`text-sm font-black ${stats.totalProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                        {isLoading ? '-' : `${stats.totalProfit > 0 ? '+' : ''}${stats.totalProfit}`}
                                    </span>
                                </div>
                                <div className="w-px h-3 bg-slate-300/50 dark:bg-slate-600/50" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">13水</span>
                                    <span className={`text-sm font-black ${thirteenStats.totalScore >= 0 ? 'text-violet-500' : 'text-red-500'}`}>
                                        {isLoading ? '-' : `${thirteenStats.totalScore > 0 ? '+' : ''}${thirteenStats.totalScore}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 趣味互动生涯统计 */}
                    {!isLoading && timerStats && (timerStats.timerCount > 0 || timerStats.eggCount > 0 || timerStats.chickenCount > 0 || timerStats.flowerCount > 0) && (
                        <div className="mb-5">
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-500">sports_esports</span>
                                趣味互动
                            </h3>
                            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 dark:from-orange-900/20 dark:to-amber-900/10 p-4 rounded-2xl shadow-sm border border-orange-200/50 dark:border-orange-800/30">
                                <div className="flex items-center justify-around">
                                    <div className="flex flex-col items-center py-2 gap-1">
                                        <span className="text-2xl">&#x23F1;&#xFE0F;</span>
                                        <span className="text-xl font-black text-orange-600 dark:text-orange-400">{timerStats.timerCount}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">被催促</span>
                                        {timerStats.timerAvgSec > 0 && (
                                            <span className="text-[9px] text-slate-400">均{timerStats.timerAvgSec}s</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center py-2 gap-1">
                                        <span className="text-2xl">&#x1F95A;</span>
                                        <span className="text-xl font-black text-red-500">{timerStats.eggCount}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">被砸蛋</span>
                                    </div>
                                    <div className="flex flex-col items-center py-2 gap-1">
                                        <span className="text-2xl">&#x1F414;</span>
                                        <span className="text-xl font-black text-yellow-600 dark:text-yellow-400">{timerStats.chickenCount}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">被抓鸡</span>
                                    </div>
                                    <div className="flex flex-col items-center py-2 gap-1">
                                        <span className="text-2xl">&#x1F339;</span>
                                        <span className="text-xl font-black text-pink-500">{timerStats.flowerCount}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">收鲜花</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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

                    {/* 13水统计 */}
                    {!isLoading && thirteenStats.totalRounds > 0 && (
                        <div className="mb-5">
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-violet-500">playing_cards</span>
                                十三水
                            </h3>
                            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 dark:from-violet-900/20 dark:to-purple-900/10 p-4 rounded-2xl shadow-sm border border-violet-200/50 dark:border-violet-800/30">
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xl font-black text-violet-600 dark:text-violet-400">{thirteenStats.totalGames}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">总场次</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xl font-black text-violet-600 dark:text-violet-400">{thirteenStats.totalRounds}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">总局数</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xl font-black text-violet-600 dark:text-violet-400">{thirteenStats.winRate}%</span>
                                        <span className="text-[10px] text-slate-500 font-bold">胜率</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className={`text-xl font-black ${thirteenStats.totalScore >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {thirteenStats.totalScore > 0 ? '+' : ''}{thirteenStats.totalScore}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold">总积分</span>
                                    </div>
                                </div>
                                <div className="flex justify-center gap-6 pt-2 border-t border-violet-200/30 dark:border-violet-700/30">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-base">🔫</span>
                                        <span className="text-sm font-bold text-orange-500">{thirteenStats.gunCount}</span>
                                        <span className="text-[10px] text-slate-500">打枪</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-base">💥</span>
                                        <span className="text-sm font-bold text-amber-500">{thirteenStats.homerunCount}</span>
                                        <span className="text-[10px] text-slate-500">全垒打</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* 修改用户名对话框 */}
                {showRename && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setShowRename(false)}>
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <div className="relative w-full max-w-[300px] rounded-2xl bg-white dark:bg-[#1e2936] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">修改用户名</h3>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={e => { setNewUsername(e.target.value); setRenameError(''); }}
                                    onKeyDown={e => { if (e.key === 'Enter' && !renameLoading) handleRename(); }}
                                    maxLength={20}
                                    autoFocus
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-base font-semibold text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="请输入新用户名"
                                />
                                {renameError && (
                                    <p className="text-xs text-red-500 mt-2">{renameError}</p>
                                )}
                                <p className="text-[11px] text-slate-400 mt-2">{newUsername.trim().length}/20</p>
                            </div>
                            <div className="flex border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setShowRename(false)}
                                    disabled={renameLoading}
                                    className="flex-1 py-3.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                    取消
                                </button>
                                <div className="w-px bg-slate-200 dark:bg-slate-700" />
                                <button
                                    onClick={handleRename}
                                    disabled={renameLoading || !newUsername.trim()}
                                    className="flex-1 py-3.5 text-sm font-bold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                                >
                                    {renameLoading ? '保存中...' : '确认修改'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 退出登录确认对话框 */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setShowLogoutConfirm(false)}>
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <div className="relative w-full max-w-[280px] rounded-2xl bg-white dark:bg-[#1e2936] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
                                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-red-500 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>logout</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">确认退出</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">退出后需要重新登录才能使用</p>
                            </div>
                            <div className="flex border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-3.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    取消
                                </button>
                                <div className="w-px bg-slate-200 dark:bg-slate-700" />
                                <button
                                    onClick={() => { logout(); navigate('/login', { replace: true }); }}
                                    className="flex-1 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                >
                                    退出登录
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 二维码分享对话框 */}
                {showQrShare && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setShowQrShare(false)}>
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <div className="relative w-full max-w-[300px] rounded-2xl bg-white dark:bg-[#1e2936] shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center px-6 pt-7 pb-6">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>share</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">分享应用</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">扫描二维码即可打开应用</p>
                                <div className="bg-white p-4 rounded-xl shadow-inner">
                                    <QRCodeSVG
                                        value={window.location.origin}
                                        size={180}
                                        level="M"
                                        bgColor="#ffffff"
                                        fgColor="#0f1923"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 break-all">{window.location.origin}</p>
                            </div>
                            <div className="border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setShowQrShare(false)}
                                    className="w-full py-3.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AnimatedPage>
    );
}
