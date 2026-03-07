import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';
import { gamesApi } from '../lib/api';

interface PlayerInfo {
    userId: string;
    username: string;
}

interface LocationState {
    players?: string[] | PlayerInfo[];
    fromGame?: boolean;
    gameId?: string;
    hostId?: string;
}

function isPlayerInfoArray(arr: unknown[]): arr is PlayerInfo[] {
    return arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null && 'userId' in arr[0];
}

export default function SeatDraw() {
    const navigate = useNavigate();
    const location = useLocation();
    const locState = location.state as LocationState | null;

    const fromGame = locState?.fromGame === true;
    const gameId = locState?.gameId || '';
    const hostId = locState?.hostId || '';

    // 初始化玩家列表——兼容旧的 string[] 格式和新的 PlayerInfo[] 格式
    const initPlayers = (): PlayerInfo[] => {
        if (!locState?.players || locState.players.length === 0) return [];
        if (isPlayerInfoArray(locState.players)) return locState.players;
        // 旧格式: string[]（从工具箱独立进入时）
        return locState.players.map(name => ({ userId: '', username: name }));
    };

    const [nameInput, setNameInput] = useState('');
    const [players, setPlayers] = useState<PlayerInfo[]>(initPlayers);
    const [result, setResult] = useState<{ player: PlayerInfo; seat: number }[] | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const resultRef = useRef<HTMLDivElement>(null);

    const handleAddPlayer = async () => {
        const name = nameInput.trim();
        if (!name) return;
        if (players.some(p => p.username === name)) return;

        if (fromGame && gameId) {
            // 从房间进入：自动创建用户并加入房间
            try {
                const { userId, username } = await gamesApi.autoCreatePlayer(name, gameId);
                setPlayers(prev => [...prev, { userId, username }]);
                setNameInput('');
                setResult(null);
            } catch (err: any) {
                setError(err.message || '添加玩家失败');
            }
        } else {
            // 独立工具模式
            setPlayers(prev => [...prev, { userId: '', username: name }]);
            setNameInput('');
            setResult(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAddPlayer();
    };

    const handleRemovePlayer = (idx: number) => {
        setPlayers(prev => prev.filter((_, i) => i !== idx));
        setResult(null);
    };

    const handleDraw = () => {
        if (players.length < 2) return;
        setIsAnimating(true);
        setSaved(false);

        // Fisher-Yates 洗牌
        const seats = Array.from({ length: players.length }, (_, i) => i + 1);
        for (let i = seats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [seats[i], seats[j]] = [seats[j], seats[i]];
        }

        const assignment = players.map((player, idx) => ({ player, seat: seats[idx] }));

        if (navigator.vibrate) navigator.vibrate(50);

        setTimeout(() => {
            setResult(assignment);
            setIsAnimating(false);

            setTimeout(() => {
                if (resultRef.current) {
                    anime({
                        targets: resultRef.current.children,
                        translateY: [20, 0],
                        opacity: [0, 1],
                        duration: 400,
                        easing: 'easeOutExpo',
                        delay: anime.stagger(80),
                    });
                }
            }, 50);
        }, 800);
    };

    const handleConfirm = async () => {
        if (!result || !gameId || !hostId) return;
        setIsSaving(true);
        setError('');
        try {
            const assignments = result
                .filter(r => r.player.userId) // 只提交有 userId 的
                .map(r => ({ userId: r.player.userId, seatNumber: r.seat }));

            await gamesApi.assignSeats(gameId, assignments, hostId);
            setSaved(true);
            setTimeout(() => navigate(-1), 600);
        } catch (err: any) {
            setError(err.message || '同步座位失败');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">座位分配</h1>
                <span className="material-symbols-outlined text-[24px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>event_seat</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* 添加玩家 */}
                <div className="flex gap-2 mb-4">
                    <input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={fromGame ? '输入新玩家昵称（自动创建并加入房间）' : '输入玩家昵称'}
                        className="flex-1 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] text-sm focus:border-primary focus:outline-none"
                        maxLength={12}
                    />
                    <button
                        onClick={handleAddPlayer}
                        disabled={!nameInput.trim()}
                        className="h-11 px-5 rounded-xl bg-primary text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40"
                    >
                        添加
                    </button>
                </div>

                {/* 玩家列表 */}
                {players.length > 0 && (
                    <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-4">
                        <div className="text-xs font-bold text-slate-400 mb-2">已添加 {players.length} 位玩家</div>
                        <div className="flex flex-wrap gap-2">
                            {players.map((p, idx) => (
                                <span
                                    key={p.userId || idx}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium"
                                >
                                    {p.username}
                                    <button onClick={() => handleRemovePlayer(idx)} className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 抽签按钮 */}
                <button
                    onClick={handleDraw}
                    disabled={players.length < 2 || isAnimating}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 mb-6"
                >
                    {isAnimating ? (
                        <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            抽签中...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[20px]">shuffle</span>
                            {result ? '重新抽签' : '开始抽签'}
                        </>
                    )}
                </button>

                {/* 结果 */}
                {result && (
                    <>
                        <div ref={resultRef}>
                            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">分配结果</div>
                            {result
                                .sort((a, b) => a.seat - b.seat)
                                .map((r) => (
                                    <div
                                        key={r.seat}
                                        className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-white dark:bg-[#1a2632] border border-slate-100 dark:border-slate-800 opacity-0"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                            <span className="text-emerald-500 text-lg font-black">{r.seat}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm">{r.player.username}</span>
                                            <span className="text-xs text-slate-400 ml-2">#{r.seat} 号位</span>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* 从房间进入时显示"确定"按钮 */}
                        {fromGame && gameId && (
                            <button
                                onClick={handleConfirm}
                                disabled={isSaving || saved}
                                className={`w-full mt-4 py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                                    saved
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
                                }`}
                            >
                                {saved ? (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                        已同步到房间
                                    </>
                                ) : isSaving ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                        同步中...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">upload</span>
                                        确定 — 同步到房间
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}

                {error && (
                    <p className="text-red-500 text-sm text-center mt-3">{error}</p>
                )}

                {players.length === 0 && !result && (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">group_add</span>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">添加至少2位玩家开始抽签</p>
                    </div>
                )}
            </div>
        </div>
    );
}
