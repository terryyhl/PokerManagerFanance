import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [
    { label: '1', minutes: 1 },
    { label: '2', minutes: 2 },
    { label: '3', minutes: 3 },
];

export default function GameClock() {
    const [totalSeconds, setTotalSeconds] = useState(0); // 选定的总秒数
    const [remaining, setRemaining] = useState(0);       // 剩余秒数
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    }, []);

    // 清理
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
                    // 震动提醒
                    if (navigator.vibrate) {
                        navigator.vibrate([200, 100, 200, 100, 400]);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        };
    }, [isRunning, remaining]);

    // 闪烁结束后自动停止（5秒后）
    useEffect(() => {
        if (isFinished) {
            flashTimerRef.current = setTimeout(() => {
                setIsFinished(false);
            }, 5000);
        }
        return () => {
            if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
        };
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

    // 格式化时间
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;

    // 颜色阶段
    const isUrgent = remaining > 0 && remaining <= 10;
    const isWarning = remaining > 10 && remaining <= 30;

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* 边缘红光 */}
            {isFinished && (
                <div className="absolute inset-0 z-50 pointer-events-none animate-edge-glow rounded-sm" />
            )}

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-center p-5 pt-8">
                <h2 className="text-xl font-bold">牌局时钟</h2>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 倒计时圆环 */}
                <div className="relative w-64 h-64 mb-10">
                    {/* 背景圆环 */}
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                        <circle
                            cx="100" cy="100" r="88"
                            fill="none"
                            stroke="currentColor"
                            className="text-slate-200 dark:text-slate-800"
                            strokeWidth="8"
                        />
                        {/* 进度圆环 */}
                        {totalSeconds > 0 && (
                            <circle
                                cx="100" cy="100" r="88"
                                fill="none"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 88}
                                strokeDashoffset={2 * Math.PI * 88 * (1 - progress)}
                                className={`transition-all duration-1000 ease-linear ${isFinished
                                    ? 'text-red-500'
                                    : isUrgent
                                        ? 'text-red-500'
                                        : isWarning
                                            ? 'text-amber-500'
                                            : 'text-primary'
                                    }`}
                                stroke="currentColor"
                            />
                        )}
                    </svg>

                    {/* 中心时间显示 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {totalSeconds > 0 ? (
                            <>
                                <span className={`text-6xl font-black tabular-nums tracking-tight transition-colors ${isFinished
                                    ? 'text-red-500 animate-pulse'
                                    : isUrgent
                                        ? 'text-red-500'
                                        : isWarning
                                            ? 'text-amber-500'
                                            : 'text-slate-900 dark:text-white'
                                    }`}>
                                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                                </span>
                                {isFinished && (
                                    <span className="text-sm font-bold text-red-500 mt-2 animate-pulse">时间到！</span>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                                <span className="material-symbols-outlined text-5xl">timer</span>
                                <span className="text-sm font-medium">选择档位开始计时</span>
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

            {/* 边缘红光脉冲动画 */}
            <style>{`
                @keyframes edge-glow {
                    0%, 100% {
                        box-shadow: inset 0 0 30px 8px rgba(239, 68, 68, 0.0);
                    }
                    50% {
                        box-shadow: inset 0 0 60px 15px rgba(239, 68, 68, 0.6);
                    }
                }
                .animate-edge-glow {
                    animation: edge-glow 0.8s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
