import React, { useState, useCallback, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';

type CoinResult = 'heads' | 'tails' | null;

export default function CoinFlip() {
    const [result, setResult] = useState<CoinResult>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [flipCount, setFlipCount] = useState(0);
    const [stats, setStats] = useState({ heads: 0, tails: 0 });
    const [lottieKey, setLottieKey] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dotLottieRef = useRef<DotLottie | null>(null);

    const handleFlip = useCallback(() => {
        if (isFlipping) return;

        // 随机决定正反面
        const isHeads = Math.random() < 0.5;
        const newResult: CoinResult = isHeads ? 'heads' : 'tails';

        setIsFlipping(true);
        setResult(null);
        // 重新挂载 Lottie 让它从头播放
        setLottieKey(prev => prev + 1);

        // 震动反馈
        if (navigator.vibrate) navigator.vibrate(50);

        // 动画播放约 2 秒后显示结果
        timerRef.current = setTimeout(() => {
            // 停止 Lottie 动画
            if (dotLottieRef.current) {
                dotLottieRef.current.pause();
            }
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
        setLottieKey(prev => prev + 1);
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

                {/* Lottie 硬币区域 */}
                <div className="relative w-52 h-52 mb-4">
                    <div className="w-full h-full overflow-hidden">
                        <DotLottieReact
                            key={lottieKey}
                            src="/coin-3d.lottie"
                            loop={isFlipping}
                            autoplay={isFlipping}
                            dotLottieRefCallback={(ref) => { dotLottieRef.current = ref; }}
                            style={{ width: '208px', height: '208px' }}
                        />
                    </div>

                    {/* 结果覆盖层 — 硬币停止后显示正/反 */}
                    {result && !isFlipping && (
                        <div className="absolute inset-0 flex items-center justify-center animate-bounce-in">
                            <div
                                className={`w-36 h-36 rounded-full flex items-center justify-center ${
                                    result === 'heads'
                                        ? 'bg-blue-500/90 shadow-lg shadow-blue-500/30'
                                        : 'bg-red-500/90 shadow-lg shadow-red-500/30'
                                }`}
                            >
                                <div className="flex flex-col items-center">
                                    <span
                                        className="text-white text-4xl font-black"
                                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                    >
                                        {result === 'heads' ? '正' : '反'}
                                    </span>
                                    <span className="text-white/80 text-xs font-bold tracking-widest mt-1">
                                        {result === 'heads' ? 'HEADS' : 'TAILS'}
                                    </span>
                                </div>
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
