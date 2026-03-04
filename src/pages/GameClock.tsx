import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Hourglass from '../components/Hourglass';

const PRESETS = [
    { label: '30s', seconds: 30 },
    { label: '1', seconds: 60 },
    { label: '2', seconds: 120 },
    { label: '3', seconds: 180 },
];

export default function GameClock() {
    const navigate = useNavigate();
    const fromGame = (useLocation().state as { fromGame?: boolean } | null)?.fromGame === true;
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

    const handleSelectPreset = (secs: number) => {
        cleanup();
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

    // 外环参数
    const R = 142;
    const C = 2 * Math.PI * R;

    const ringStroke = isFinished || isUrgent
        ? '#ef4444'
        : isWarning
            ? '#f59e0b'
            : '#3b82f6';

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
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">牌局时钟</h1>
                <span className="material-symbols-outlined text-[24px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 外环 + 沙漏 */}
                <div className="relative mb-4" style={{ width: 300, height: 300 }}>
                    {/* 进度圆环 SVG */}
                    <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 300 300"
                        style={{ transform: 'rotate(-90deg)' }}
                    >
                        {/* 背景轨道 */}
                        <circle
                            cx="150" cy="150" r={R}
                            fill="none" strokeWidth="4"
                            className="stroke-slate-200 dark:stroke-slate-700"
                        />
                        {/* 进度弧 */}
                        {totalSeconds > 0 && (
                            <circle
                                cx="150" cy="150" r={R}
                                fill="none" strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - progress)}
                                stroke={ringStroke}
                                style={{
                                    transition: 'stroke-dashoffset 1s linear, stroke 0.5s',
                                    filter: `drop-shadow(0 0 6px ${ringStroke})`,
                                }}
                            />
                        )}
                    </svg>

                    {/* 沙漏居中 */}
                    <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 18 }}>
                        <Hourglass
                            progress={progress}
                            isRunning={isRunning}
                            size={160}
                        />
                    </div>
                </div>

                {/* 倒计时数字 */}
                <div className="text-center mb-6">
                    {totalSeconds > 0 ? (
                        <>
                            <span className={`text-[42px] font-black tabular-nums tracking-tight transition-colors ${timeColor}`}>
                                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                            </span>
                            {isFinished && (
                                <p className="text-sm font-bold text-red-500 animate-pulse mt-1">时间到！</p>
                            )}
                        </>
                    ) : (
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">选择档位开始</span>
                    )}
                </div>

                {/* 档位选择 */}
                <div className="flex items-center gap-4 mb-6">
                    {PRESETS.map(preset => {
                        const isActive = isRunning && totalSeconds === preset.seconds;
                        const isSecondsOnly = preset.seconds < 60;
                        return (
                            <button
                                key={preset.label}
                                onClick={() => handleSelectPreset(preset.seconds)}
                                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 font-bold transition-all active:scale-95 ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                                    : 'bg-white dark:bg-[#1a2632] border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                                }`}
                            >
                                <span className="text-2xl font-black">{preset.label}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{isSecondsOnly ? '秒' : '分钟'}</span>
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
