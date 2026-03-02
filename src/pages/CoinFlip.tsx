import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

type CoinResult = 'heads' | 'tails' | null;

export default function CoinFlip() {
    const navigate = useNavigate();
    const fromGame = (useLocation().state as { fromGame?: boolean } | null)?.fromGame === true;
    const [result, setResult] = useState<CoinResult>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [flipCount, setFlipCount] = useState(0);
    const [stats, setStats] = useState({ heads: 0, tails: 0 });
    const [lottieKey, setLottieKey] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFlip = useCallback(() => {
        if (isFlipping) return;

        const isHeads = Math.random() < 0.5;
        const newResult: CoinResult = isHeads ? 'heads' : 'tails';

        setIsFlipping(true);
        setResult(null);
        setLottieKey(prev => prev + 1);

        if (navigator.vibrate) navigator.vibrate(50);

        timerRef.current = setTimeout(() => {
            setResult(newResult);
            setIsFlipping(false);
            setFlipCount(prev => prev + 1);
            setStats(prev => ({
                ...prev,
                [newResult]: prev[newResult] + 1,
            }));
        }, 2000);
    }, [isFlipping]);

    const handleReset = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setResult(null);
        setIsFlipping(false);
        setFlipCount(0);
        setStats({ heads: 0, tails: 0 });
    };

    const resultText = result === 'heads' ? '正面' : result === 'tails' ? '反面' : null;
    const resultColor = result === 'heads' ? 'text-blue-500' : result === 'tails' ? 'text-red-500' : '';

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">掷硬币</h1>
                <span className="material-symbols-outlined text-[24px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 硬币区域 */}
                <div className="relative w-48 h-48 mb-6">
                    {/* 翻转中 — Lottie 动画 */}
                    {isFlipping && (
                        <div className="w-full h-full overflow-hidden">
                            <DotLottieReact
                                key={lottieKey}
                                src="/coin-flip.lottie"
                                loop
                                autoplay
                                style={{ width: '192px', height: '192px' }}
                            />
                        </div>
                    )}

                    {/* 待机 / 结果 — 静态硬币 */}
                    {!isFlipping && (
                        <div className={`w-full h-full rounded-full flex items-center justify-center ${
                            result === 'heads'
                                ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-xl shadow-blue-500/30'
                                : result === 'tails'
                                    ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-xl shadow-red-500/30'
                                    : 'bg-gradient-to-br from-amber-300 to-yellow-500 shadow-xl shadow-amber-400/30'
                        } ${result ? 'animate-bounce-in' : ''}`}
                            style={{ border: '5px solid rgba(255,255,255,0.25)' }}
                        >
                            <div className="flex flex-col items-center">
                                {result ? (
                                    <>
                                        <span className="text-white text-5xl font-black" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                                            {result === 'heads' ? '正' : '反'}
                                        </span>
                                        <div className="w-14 h-0.5 bg-white/30 rounded my-1.5" />
                                        <span className="text-white/80 text-xs font-bold tracking-widest">
                                            {result === 'heads' ? 'HEADS' : 'TAILS'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-white/90 text-4xl font-black" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>$</span>
                                        <span className="text-white/60 text-[10px] font-bold tracking-wider mt-1">FLIP ME</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 结果文字 */}
                <div className="h-12 flex items-center justify-center mb-6">
                    {isFlipping ? (
                        <span className="text-sm font-bold text-slate-400 animate-pulse">硬币翻转中...</span>
                    ) : result ? (
                        <span className={`text-3xl font-black animate-bounce-in ${resultColor}`}>{resultText}!</span>
                    ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">点击下方按钮掷硬币</span>
                    )}
                </div>

                {/* 掷硬币按钮 */}
                <button
                    onClick={handleFlip}
                    disabled={isFlipping}
                    className={`px-10 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 mb-6 ${isFlipping
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105'
                        }`}
                >
                    <span className="material-symbols-outlined text-[20px] mr-2 align-middle">casino</span>
                    {flipCount === 0 ? '掷硬币' : '再掷一次'}
                </button>

                {/* 统计 */}
                {flipCount > 0 && (
                    <div className="flex items-center gap-6 mb-4">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-blue-500">{stats.heads}</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">正面</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-500">{flipCount} 次</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">总计</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-red-500">{stats.tails}</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">反面</span>
                        </div>
                    </div>
                )}

                {/* 重置 */}
                {flipCount > 0 && !isFlipping && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        重置统计
                    </button>
                )}
            </div>

            <style>{`
                @keyframes bounce-in {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 1; transform: scale(1.1); }
                    70% { transform: scale(0.95); }
                    100% { transform: scale(1); }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}
