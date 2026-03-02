import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';

/** 骰子面的Unicode点数表示 */
const DICE_FACES = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

export default function DiceRoll() {
    const navigate = useNavigate();
    const fromGame = (useLocation().state as { fromGame?: boolean } | null)?.fromGame === true;
    const [diceCount, setDiceCount] = useState(2);
    const [results, setResults] = useState<number[]>([]);
    const [isRolling, setIsRolling] = useState(false);
    const [rollCount, setRollCount] = useState(0);
    const diceRef = useRef<HTMLDivElement>(null);

    const handleRoll = useCallback(() => {
        if (isRolling) return;
        setIsRolling(true);

        if (navigator.vibrate) navigator.vibrate(50);

        // 快速切换随机数字的动画效果
        let tickCount = 0;
        const totalTicks = 12;
        const interval = setInterval(() => {
            const tempResults = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
            setResults(tempResults);
            tickCount++;

            if (tickCount >= totalTicks) {
                clearInterval(interval);
                // 最终结果
                const finalResults = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
                setResults(finalResults);
                setIsRolling(false);
                setRollCount(prev => prev + 1);

                if (navigator.vibrate) navigator.vibrate([80, 40, 80]);

                // 弹跳动画
                if (diceRef.current) {
                    anime({
                        targets: diceRef.current.children,
                        scale: [0.6, 1.15, 1],
                        duration: 400,
                        easing: 'easeOutBack',
                        delay: anime.stagger(60),
                    });
                }
            }
        }, 60);
    }, [isRolling, diceCount]);

    const total = results.reduce((sum, v) => sum + v, 0);

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => fromGame ? navigate(-1) : navigate('/tools')} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">掷骰子</h1>
                <span className="material-symbols-outlined text-[24px] text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 骰子数量选择 */}
                <div className="flex items-center gap-3 mb-8">
                    {[1, 2, 3].map(n => (
                        <button
                            key={n}
                            onClick={() => { setDiceCount(n); setResults([]); setRollCount(0); }}
                            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-bold transition-all active:scale-95 ${
                                diceCount === n
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105'
                                    : 'bg-white dark:bg-[#1a2632] border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <span className="text-xl font-black">{n}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">骰子</span>
                        </button>
                    ))}
                </div>

                {/* 骰子展示区 */}
                <div ref={diceRef} className="flex items-center justify-center gap-4 mb-6 min-h-[120px]">
                    {results.length > 0 ? results.map((val, idx) => (
                        <div
                            key={idx}
                            className={`w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                                isRolling
                                    ? 'bg-slate-200 dark:bg-slate-700'
                                    : 'bg-white dark:bg-[#1a2632] border-2 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <span className={`text-5xl leading-none ${isRolling ? 'opacity-50' : ''}`}>
                                {DICE_FACES[val]}
                            </span>
                        </div>
                    )) : (
                        // 占位骰子
                        Array.from({ length: diceCount }).map((_, idx) => (
                            <div
                                key={idx}
                                className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center"
                            >
                                <span className="text-4xl text-slate-300 dark:text-slate-600">{DICE_FACES[6]}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* 总点数 */}
                {results.length > 0 && !isRolling && diceCount > 1 && (
                    <div className="mb-6 text-center">
                        <span className="text-xs text-slate-400 font-medium">总点数</span>
                        <div className="text-4xl font-black text-orange-500">{total}</div>
                    </div>
                )}

                {/* 掷骰子按钮 */}
                <button
                    onClick={handleRoll}
                    disabled={isRolling}
                    className={`px-10 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 mb-4 ${
                        isRolling
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl'
                    }`}
                >
                    <span className="material-symbols-outlined text-[20px] mr-2 align-middle">casino</span>
                    {rollCount === 0 ? '掷骰子' : '再掷一次'}
                </button>

                {rollCount > 0 && !isRolling && (
                    <span className="text-xs text-slate-400">已掷 {rollCount} 次</span>
                )}
            </div>
        </div>
    );
}
