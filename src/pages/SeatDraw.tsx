import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';

interface LocationState {
    players?: string[];
    fromGame?: boolean;
}

export default function SeatDraw() {
    const navigate = useNavigate();
    const location = useLocation();
    const locState = location.state as LocationState | null;

    const [nameInput, setNameInput] = useState('');
    const [players, setPlayers] = useState<string[]>(locState?.players || []);
    const fromGame = locState?.fromGame === true;
    const [result, setResult] = useState<{ name: string; seat: number }[] | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);

    const handleAddPlayer = () => {
        const name = nameInput.trim();
        if (!name) return;
        if (players.includes(name)) return;
        setPlayers(prev => [...prev, name]);
        setNameInput('');
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

        // 随机打乱座位
        const seats = Array.from({ length: players.length }, (_, i) => i + 1);
        for (let i = seats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [seats[i], seats[j]] = [seats[j], seats[i]];
        }

        const assignment = players.map((name, idx) => ({ name, seat: seats[idx] }));

        if (navigator.vibrate) navigator.vibrate(50);

        setTimeout(() => {
            setResult(assignment);
            setIsAnimating(false);

            // 动画
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

    const handleReset = () => {
        setResult(null);
    };

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => fromGame ? navigate(-1) : navigate('/tools')} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
                        placeholder="输入玩家昵称"
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
                            {players.map((name, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium"
                                >
                                    {name}
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
                                        <span className="font-bold text-sm">{r.name}</span>
                                        <span className="text-xs text-slate-400 ml-2">#{r.seat} 号位</span>
                                    </div>
                                </div>
                            ))}
                    </div>
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
