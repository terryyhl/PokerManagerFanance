import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [
    { label: '1', minutes: 1 },
    { label: '2', minutes: 2 },
    { label: '3', minutes: 3 },
];

export default function GameClock() {
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    // 倒计时核心
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

    // 闪烁 5 秒后停止
    useEffect(() => {
        if (isFinished) {
            flashTimerRef.current = setTimeout(() => setIsFinished(false), 5000);
        }
        return () => { if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; } };
    }, [isFinished]);

    const handleSelectPreset = (minutes: number) => {
        cleanup();
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
    const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;

    const isUrgent = remaining > 0 && remaining <= 10;
    const isWarning = remaining > 10 && remaining <= 30;

    // 水面 Y 位置：progress=1 时满水 (y=10%), progress=0 时空 (y=100%)
    const waterY = 100 - progress * 90; // 10 ~ 100

    // 水面颜色
    const waterColor = isFinished || isUrgent
        ? { fill1: '#ef4444', fill2: '#dc2626', opacity1: 0.7, opacity2: 0.5 }
        : isWarning
            ? { fill1: '#f59e0b', fill2: '#d97706', opacity1: 0.7, opacity2: 0.5 }
            : { fill1: '#3b82f6', fill2: '#2563eb', opacity1: 0.6, opacity2: 0.4 };

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

                {/* 水流圆形倒计时 */}
                <div className="relative w-56 h-56 mb-8">
                    <svg viewBox="0 0 200 200" className="w-full h-full" style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.1))' }}>
                        <defs>
                            {/* 圆形裁切 */}
                            <clipPath id="circle-clip">
                                <circle cx="100" cy="100" r="90" />
                            </clipPath>
                        </defs>

                        {/* 外圈 */}
                        <circle cx="100" cy="100" r="94" fill="none" strokeWidth="3"
                            className={`transition-colors duration-500 ${
                                isFinished ? 'stroke-red-500' : isUrgent ? 'stroke-red-400' : isWarning ? 'stroke-amber-400' : 'stroke-slate-300 dark:stroke-slate-700'
                            }`}
                        />

                        {/* 内部背景 */}
                        <circle cx="100" cy="100" r="90" className="fill-slate-50 dark:fill-[#0f1923]" />

                        {/* 水体 + 波浪（裁切在圆内） */}
                        <g clipPath="url(#circle-clip)">
                            {/* 后波 */}
                            <path
                                d={`M0 ${waterY + 8}
                                    Q25 ${waterY - 4} 50 ${waterY + 8}
                                    T100 ${waterY + 8}
                                    T150 ${waterY + 8}
                                    T200 ${waterY + 8}
                                    V200 H0 Z`}
                                fill={waterColor.fill2}
                                opacity={waterColor.opacity2}
                                className="transition-all duration-1000 ease-linear"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    type="translate"
                                    values="0,0; -50,0; 0,0"
                                    dur="4s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 前波 */}
                            <path
                                d={`M0 ${waterY}
                                    Q25 ${waterY - 6} 50 ${waterY}
                                    T100 ${waterY}
                                    T150 ${waterY}
                                    T200 ${waterY}
                                    V200 H0 Z`}
                                fill={waterColor.fill1}
                                opacity={waterColor.opacity1}
                                className="transition-all duration-1000 ease-linear"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    type="translate"
                                    values="0,0; 50,0; 0,0"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </path>
                        </g>

                        {/* 内圈描边 */}
                        <circle cx="100" cy="100" r="90" fill="none" strokeWidth="2"
                            className={`transition-colors duration-500 ${
                                isFinished ? 'stroke-red-400' : isUrgent ? 'stroke-red-300' : isWarning ? 'stroke-amber-300' : 'stroke-slate-200 dark:stroke-slate-800'
                            }`}
                        />
                    </svg>

                    {/* 中心时间 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {totalSeconds > 0 ? (
                            <>
                                <span className={`text-5xl font-black tabular-nums tracking-tight transition-colors drop-shadow-sm ${
                                    isFinished ? 'text-red-500 animate-pulse'
                                    : isUrgent ? 'text-red-500'
                                    : isWarning ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-800 dark:text-white'
                                }`}>
                                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                                </span>
                                {isFinished && (
                                    <span className="text-sm font-bold text-red-500 mt-1 animate-pulse">时间到！</span>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                                <span className="material-symbols-outlined text-4xl">water_drop</span>
                                <span className="text-xs font-medium">选择档位开始</span>
                            </div>
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

            {/* 动画 CSS */}
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
