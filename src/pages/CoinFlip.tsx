import React, { useState, useCallback, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

type CoinResult = 'heads' | 'tails' | null;

export default function CoinFlip() {
    const [result, setResult] = useState<CoinResult>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [flipCount, setFlipCount] = useState(0);
    const [stats, setStats] = useState({ heads: 0, tails: 0 });
    const coinRef = useRef<HTMLDivElement>(null);

    const handleFlip = useCallback(() => {
        if (isFlipping) return;
        setIsFlipping(true);
        setResult(null);

        // 随机决定正反面
        const isHeads = Math.random() < 0.5;
        const newResult: CoinResult = isHeads ? 'heads' : 'tails';

        // 触发翻转动画
        if (coinRef.current) {
            // 重置动画
            coinRef.current.style.animation = 'none';
            // 强制 reflow
            void coinRef.current.offsetHeight;
            // 正面多转半圈 = 奇数个180度, 反面 = 偶数个180度
            coinRef.current.style.animation = isHeads
                ? 'coin-flip-heads 1.2s ease-out forwards'
                : 'coin-flip-tails 1.2s ease-out forwards';
        }

        // 震动反馈
        if (navigator.vibrate) navigator.vibrate(50);

        setTimeout(() => {
            setResult(newResult);
            setIsFlipping(false);
            setFlipCount(prev => prev + 1);
            setStats(prev => ({
                ...prev,
                [newResult]: prev[newResult] + 1,
            }));
        }, 1200);
    }, [isFlipping]);

    const handleReset = () => {
        setResult(null);
        setFlipCount(0);
        setStats({ heads: 0, tails: 0 });
        if (coinRef.current) {
            coinRef.current.style.animation = 'none';
        }
    };

    const resultText = result === 'heads' ? '正面' : result === 'tails' ? '反面' : null;
    const resultColor = result === 'heads' ? 'text-blue-500' : result === 'tails' ? 'text-red-500' : '';

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-center p-5 pt-8">
                <h2 className="text-xl font-bold">掷硬币</h2>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 硬币区域 */}
                <div className="relative w-48 h-48 mb-8" style={{ perspective: '800px' }}>
                    <div
                        ref={coinRef}
                        className="w-full h-full relative"
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {/* 正面 — Google 蓝 */}
                        <div
                            className="absolute inset-0 rounded-full flex items-center justify-center"
                            style={{
                                backfaceVisibility: 'hidden',
                                background: 'linear-gradient(135deg, #4285F4 0%, #356AC3 100%)',
                                boxShadow: '0 8px 32px rgba(66, 133, 244, 0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                                border: '4px solid rgba(255,255,255,0.2)',
                            }}
                        >
                            <div className="flex flex-col items-center">
                                <span className="text-white text-5xl font-black" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>正</span>
                                <div className="w-16 h-0.5 bg-white/30 rounded my-1" />
                                <span className="text-white/80 text-xs font-bold tracking-widest">HEADS</span>
                            </div>
                        </div>

                        {/* 反面 — Google 红 */}
                        <div
                            className="absolute inset-0 rounded-full flex items-center justify-center"
                            style={{
                                backfaceVisibility: 'hidden',
                                transform: 'rotateX(180deg)',
                                background: 'linear-gradient(135deg, #EA4335 0%, #C5221F 100%)',
                                boxShadow: '0 8px 32px rgba(234, 67, 53, 0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
                                border: '4px solid rgba(255,255,255,0.2)',
                            }}
                        >
                            <div className="flex flex-col items-center">
                                <span className="text-white text-5xl font-black" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>反</span>
                                <div className="w-16 h-0.5 bg-white/30 rounded my-1" />
                                <span className="text-white/80 text-xs font-bold tracking-widest">TAILS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 结果文字 */}
                <div className="h-12 flex items-center justify-center mb-6">
                    {isFlipping ? (
                        <div className="flex items-center gap-2">
                            <div className="w-48 h-12 overflow-hidden">
                                <DotLottieReact
                                    src="/coin-flip.lottie"
                                    loop
                                    autoplay
                                    style={{ width: '192px', height: '48px' }}
                                />
                            </div>
                        </div>
                    ) : result ? (
                        <div className="flex flex-col items-center animate-bounce-in">
                            <span className={`text-3xl font-black ${resultColor}`}>{resultText}</span>
                        </div>
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
                @keyframes coin-flip-heads {
                    0% { transform: rotateX(0deg) translateY(0); }
                    15% { transform: rotateX(360deg) translateY(-80px); }
                    30% { transform: rotateX(720deg) translateY(-120px); }
                    50% { transform: rotateX(1080deg) translateY(-60px); }
                    70% { transform: rotateX(1440deg) translateY(-20px); }
                    85% { transform: rotateX(1620deg) translateY(-5px); }
                    100% { transform: rotateX(1800deg) translateY(0); }
                }
                @keyframes coin-flip-tails {
                    0% { transform: rotateX(0deg) translateY(0); }
                    15% { transform: rotateX(360deg) translateY(-80px); }
                    30% { transform: rotateX(720deg) translateY(-120px); }
                    50% { transform: rotateX(1080deg) translateY(-60px); }
                    70% { transform: rotateX(1440deg) translateY(-20px); }
                    85% { transform: rotateX(1620deg) translateY(-5px); }
                    100% { transform: rotateX(1980deg) translateY(0); }
                }
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
