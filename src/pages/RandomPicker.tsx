import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';

interface LocationState {
    players?: string[];
    fromGame?: boolean;
}

export default function RandomPicker() {
    const navigate = useNavigate();
    const location = useLocation();
    const locState = location.state as LocationState | null;

    const [nameInput, setNameInput] = useState('');
    const [players, setPlayers] = useState<string[]>(locState?.players || []);
    const fromGame = locState?.fromGame === true;
    const [picked, setPicked] = useState<string | null>(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState<number>(-1);
    const pickedRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handleAdd = () => {
        const name = nameInput.trim();
        if (!name || players.includes(name)) return;
        setPlayers(prev => [...prev, name]);
        setNameInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAdd();
    };

    const handleRemove = (idx: number) => {
        setPlayers(prev => prev.filter((_, i) => i !== idx));
        setPicked(null);
    };

    const handlePick = useCallback(() => {
        if (players.length < 2 || isSpinning) return;
        setIsSpinning(true);
        setPicked(null);

        if (navigator.vibrate) navigator.vibrate(30);

        // 滚动高亮效果
        let count = 0;
        const totalCycles = 15 + Math.floor(Math.random() * 10);
        let speed = 60;

        const tick = () => {
            setHighlightIdx(count % players.length);
            count++;

            if (count >= totalCycles) {
                // 最终选中
                const winner = Math.floor(Math.random() * players.length);
                setHighlightIdx(winner);
                setPicked(players[winner]);
                setIsSpinning(false);

                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

                // 弹出动画
                setTimeout(() => {
                    if (pickedRef.current) {
                        anime({
                            targets: pickedRef.current,
                            scale: [0.5, 1],
                            opacity: [0, 1],
                            duration: 500,
                            easing: 'easeOutBack',
                        });
                    }
                }, 50);
                return;
            }

            // 逐渐减速
            speed = 60 + (count / totalCycles) * 200;
            intervalRef.current = setTimeout(tick, speed);
        };

        tick();
    }, [players, isSpinning]);

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => fromGame ? navigate(-1) : navigate('/tools')} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">抽选庄家</h1>
                <span className="material-symbols-outlined text-[24px] text-purple-500" style={{ fontVariationSettings: "'FILL' 1" }}>person_pin_circle</span>
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
                        onClick={handleAdd}
                        disabled={!nameInput.trim()}
                        className="h-11 px-5 rounded-xl bg-primary text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40"
                    >
                        添加
                    </button>
                </div>

                {/* 玩家圆环 */}
                {players.length > 0 && (
                    <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-100 dark:border-slate-800 p-4 mb-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                            {players.map((name, idx) => {
                                const isHighlight = isSpinning && highlightIdx === idx;
                                const isWinner = !isSpinning && picked === name;
                                return (
                                    <div
                                        key={idx}
                                        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-100 ${
                                            isWinner
                                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-110'
                                                : isHighlight
                                                    ? 'bg-purple-500/20 text-purple-500 dark:text-purple-400 scale-105'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {name}
                                        {!isSpinning && !picked && (
                                            <button onClick={() => handleRemove(idx)} className="text-slate-400 hover:text-red-500">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        )}
                                        {isWinner && (
                                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 选中结果 */}
                {picked && !isSpinning && (
                    <div ref={pickedRef} className="text-center py-6 mb-4" style={{ opacity: 0 }}>
                        <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-xl shadow-purple-500/25">
                            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                            <div className="text-left">
                                <div className="text-xs font-medium opacity-80">本轮庄家</div>
                                <div className="text-2xl font-black">{picked}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 抽选按钮 */}
                <button
                    onClick={handlePick}
                    disabled={players.length < 2 || isSpinning}
                    className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 mb-4"
                >
                    {isSpinning ? (
                        <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                            选择中...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[20px]">shuffle</span>
                            {picked ? '再选一次' : '随机选人'}
                        </>
                    )}
                </button>

                {players.length === 0 && (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">group_add</span>
                        <p className="text-slate-400 dark:text-slate-500 text-sm">添加至少2位玩家</p>
                    </div>
                )}
            </div>
        </div>
    );
}
