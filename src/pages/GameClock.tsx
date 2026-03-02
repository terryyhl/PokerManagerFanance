import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const PRESETS = [
    { label: '1', minutes: 1 },
    { label: '2', minutes: 2 },
    { label: '3', minutes: 3 },
];

/** 可用的 Lottie 动画列表，每次开启闹钟随机选一个 */
const LOTTIE_ANIMATIONS = [
    '/panda-sleeping.lottie',
    '/cat-loading.lottie',
    '/cat-love.lottie',
    '/lovely-cats.lottie',
];

export default function GameClock() {
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 每次开启闹钟随机换一个动画
    const [lottieSrc, setLottieSrc] = useState(
        () => LOTTIE_ANIMATIONS[Math.floor(Math.random() * LOTTIE_ANIMATIONS.length)]
    );

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    useEffect(() => {
        if (!isRunning || remaining <= 0) return;
        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current!);
                    intervalRef.current = null;
                    setIsRunning(false);
                    setIsFinished(true);
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [isRunning, remaining]);

    useEffect(() => {
        if (isFinished) {
            flashTimerRef.current = setTimeout(() => setIsFinished(false), 5000);
        }
        return () => { if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; } };
    }, [isFinished]);

    const handleSelectPreset = (minutes: number) => {
        cleanup();
        setLottieSrc(LOTTIE_ANIMATIONS[Math.floor(Math.random() * LOTTIE_ANIMATIONS.length)]);
        const secs = minutes * 60;
        setTotalSeconds(secs);
        setRemaining(secs);
        setIsRunning(true);
        setIsFinished(false);
    };

    const handleReset = () => {
        cleanup();
        setIsRunning(false);
        setIsFinished(false);
        setRemaining(0);
        setTotalSeconds(0);
    };

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
    const isUrgent = remaining > 0 && remaining <= 10;
    const isWarning = remaining > 10 && remaining <= 30;

    const R = 88;
    const C = 2 * Math.PI * R;

    const ringColor = isFinished || isUrgent
        ? 'stroke-red-500'
        : isWarning
            ? 'stroke-amber-500'
            : 'stroke-primary';

    const timeColor = isFinished
        ? 'text-red-500 animate-pulse'
        : isUrgent
            ? 'text-red-500'
            : isWarning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-800 dark:text-white';

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* 边缘红光 */}
            {isFinished && (
                <div className="absolute inset-0 z-50 pointer-events-none animate-edge-glow" />
            )}

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-center p-5 pt-8">
                <h2 className="text-xl font-bold">牌局时钟</h2>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 圆环进度 + 熊猫动画 */}
                <div className="relative w-60 h-60 mb-8">
                    {/* 进度圆环 SVG */}
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                        {/* 背景轨道 */}
                        <circle
                            cx="100" cy="100" r={R}
                            fill="none"
                            strokeWidth="6"
                            className="stroke-slate-200 dark:stroke-slate-800"
                        />
                        {/* 进度弧 */}
                        {totalSeconds > 0 && (
                            <circle
                                cx="100" cy="100" r={R}
                                fill="none"
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - progress)}
                                className={`transition-all duration-1000 ease-linear ${ringColor}`}
                            />
                        )}
                    </svg>

                    {/* 圆内内容 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {/* Lottie 动画 */}
                        <div
                            className={`w-28 transition-all ${!isRunning && !isFinished && totalSeconds === 0 ? 'opacity-40 grayscale' : ''} ${isFinished ? 'opacity-60' : ''}`}
                        >
                            <DotLottieReact
                                key={lottieSrc}
                                src={lottieSrc}
                                loop
                                autoplay
                            />
                        </div>

                        {/* 倒计时数字 */}
                        {totalSeconds > 0 ? (
                            <span className={`text-3xl font-black tabular-nums tracking-tight -mt-1 transition-colors ${timeColor}`}>
                                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                            </span>
                        ) : (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">选择档位开始</span>
                        )}

                        {isFinished && (
                            <span className="text-xs font-bold text-red-500 animate-pulse">时间到！</span>
                        )}
                    </div>
                </div>

                {/* 档位选择 */}
                <div className="flex items-center gap-4 mb-6">
                    {PRESETS.map(preset => {
                        const isActive = isRunning && totalSeconds === preset.minutes * 60;
                        return (
                            <button
                                key={preset.label}
                                onClick={() => handleSelectPreset(preset.minutes)}
                                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 font-bold transition-all active:scale-95 ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                                    : 'bg-white dark:bg-[#1a2632] border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                                }`}
                            >
                                <span className="text-2xl font-black">{preset.label}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">分钟</span>
                            </button>
                        );
                    })}
                </div>

                {/* 重置按钮 */}
                {(isRunning || isFinished || remaining > 0) && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">stop</span>
                        重置
                    </button>
                )}
            </div>

            <style>{`
                @keyframes edge-glow {
                    0%, 100% { box-shadow: inset 0 0 30px 8px rgba(239, 68, 68, 0.0); }
                    50% { box-shadow: inset 0 0 60px 15px rgba(239, 68, 68, 0.6); }
                }
                .animate-edge-glow {
                    animation: edge-glow 0.8s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
