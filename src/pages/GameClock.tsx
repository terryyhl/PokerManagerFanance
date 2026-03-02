import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [
    { label: '1', minutes: 1 },
    { label: '2', minutes: 2 },
    { label: '3', minutes: 3 },
];

/** Inline SVG incense burner with animated smoke */
function IncenseAnimation({ state }: { state: 'idle' | 'running' | 'finished' }) {
    const smokeOpacity = state === 'idle' ? 0.15 : state === 'finished' ? 0.3 : 0.7;
    const burnerColor = state === 'finished' ? '#ef4444' : state === 'idle' ? '#94a3b8' : '#f59e0b';
    const smokeColor = state === 'finished' ? '#ef4444' : '#94a3b8';
    const glowColor = state === 'running' ? '#f59e0b' : state === 'finished' ? '#ef4444' : 'transparent';

    return (
        <svg viewBox="0 0 120 120" className="w-24 h-24" aria-label="烧香动画">
            {/* 发光滤镜 */}
            <defs>
                <filter id="smoke-blur">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
                </filter>
                <filter id="ember-glow">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                </filter>
            </defs>

            {/* 烟 — 三缕, 只在 running/finished 明显, idle 很淡 */}
            <g opacity={smokeOpacity} filter="url(#smoke-blur)">
                {/* 左烟 */}
                <path d="M52 58 Q48 42 52 28 Q56 14 50 2" fill="none" stroke={smokeColor} strokeWidth="3" strokeLinecap="round">
                    {state !== 'idle' && (
                        <animate attributeName="d"
                            values="M52 58 Q48 42 52 28 Q56 14 50 2;M52 58 Q44 44 50 30 Q54 16 48 4;M52 58 Q48 42 52 28 Q56 14 50 2"
                            dur="3s" repeatCount="indefinite" />
                    )}
                </path>
                {/* 中烟 */}
                <path d="M60 56 Q60 40 60 26 Q60 12 60 0" fill="none" stroke={smokeColor} strokeWidth="3.5" strokeLinecap="round">
                    {state !== 'idle' && (
                        <animate attributeName="d"
                            values="M60 56 Q60 40 60 26 Q60 12 60 0;M60 56 Q64 42 58 28 Q54 14 62 2;M60 56 Q60 40 60 26 Q60 12 60 0"
                            dur="2.6s" repeatCount="indefinite" />
                    )}
                </path>
                {/* 右烟 */}
                <path d="M68 58 Q72 42 68 28 Q64 14 70 2" fill="none" stroke={smokeColor} strokeWidth="3" strokeLinecap="round">
                    {state !== 'idle' && (
                        <animate attributeName="d"
                            values="M68 58 Q72 42 68 28 Q64 14 70 2;M68 58 Q76 44 70 30 Q66 16 72 4;M68 58 Q72 42 68 28 Q64 14 70 2"
                            dur="3.4s" repeatCount="indefinite" />
                    )}
                </path>
            </g>

            {/* 香炉底座 — 三足铜炉 */}
            <g transform="translate(60, 82)">
                {/* 炉身 — 碗形 */}
                <path d={`M-22 0 Q-24 -16 -14 -20 L14 -20 Q24 -16 22 0 Z`}
                    fill={burnerColor} opacity="0.85" />
                {/* 炉口高光 */}
                <rect x="-16" y="-22" width="32" height="3" rx="1.5"
                    fill={burnerColor} opacity="1" />
                {/* 炉腹纹饰 */}
                <ellipse cx="0" cy="-10" rx="12" ry="4" fill="none" stroke="white" strokeWidth="0.8" opacity="0.25" />
                {/* 三足 */}
                <line x1="-16" y1="0" x2="-20" y2="12" stroke={burnerColor} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                <line x1="0" y1="2" x2="0" y2="14" stroke={burnerColor} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                <line x1="16" y1="0" x2="20" y2="12" stroke={burnerColor} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            </g>

            {/* 香 — 三根细棍 */}
            <g>
                <line x1="52" y1="62" x2="50" y2="40" stroke={burnerColor} strokeWidth="1.5" opacity="0.7" />
                <line x1="60" y1="60" x2="60" y2="38" stroke={burnerColor} strokeWidth="1.5" opacity="0.7" />
                <line x1="68" y1="62" x2="70" y2="40" stroke={burnerColor} strokeWidth="1.5" opacity="0.7" />
            </g>

            {/* 香头火星 */}
            {state !== 'idle' && (
                <g filter="url(#ember-glow)">
                    <circle cx="50" cy="40" r="2" fill={glowColor} opacity="0.9">
                        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="60" cy="38" r="2.2" fill={glowColor} opacity="0.9">
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="70" cy="40" r="2" fill={glowColor} opacity="0.9">
                        <animate attributeName="opacity" values="0.9;0.5;0.9" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                </g>
            )}
        </svg>
    );
}

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

                {/* 圆环进度 + 烧香动画 */}
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
                        {/* 烧香动画 */}
                        <IncenseAnimation
                            state={isFinished ? 'finished' : isRunning ? 'running' : 'idle'}
                        />

                        {/* 倒计时数字 */}
                        {totalSeconds > 0 ? (
                            <span className={`text-3xl font-black tabular-nums tracking-tight mt-1 transition-colors ${timeColor}`}>
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
