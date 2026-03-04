import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { DotLottie } from '@lottiefiles/dotlottie-web';

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

    // DotLottie 实例引用，用于帧同步控制
    const dotLottieRef = useRef<DotLottie | null>(null);

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    // 倒计时核心逻辑
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

    // 沙漏帧同步：将 remaining/totalSeconds 映射到 Lottie 帧
    useEffect(() => {
        const lottie = dotLottieRef.current;
        if (!lottie || totalSeconds <= 0) return;

        const total = lottie.totalFrames;
        if (!total || total <= 0) return;

        // progress: 1(满) → 0(空)
        const progress = remaining / totalSeconds;
        // 帧映射：progress=1 → frame=0（沙漏满）, progress=0 → frame=totalFrames（沙漏空）
        const targetFrame = Math.round((1 - progress) * (total - 1));
        lottie.setFrame(targetFrame);
    }, [remaining, totalSeconds]);

    // 结束闪烁 5 秒后恢复
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
        // 重置沙漏到起始帧
        if (dotLottieRef.current) {
            dotLottieRef.current.setFrame(0);
        }
    };

    const handleReset = () => {
        cleanup();
        setIsRunning(false);
        setIsFinished(false);
        setRemaining(0);
        setTotalSeconds(0);
        // 重置沙漏到起始帧
        if (dotLottieRef.current) {
            dotLottieRef.current.setFrame(0);
        }
    };

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const isUrgent = remaining > 0 && remaining <= 10;
    const isWarning = remaining > 10 && remaining <= 30;

    const timeColor = isFinished
        ? 'text-red-500 animate-pulse'
        : isUrgent
            ? 'text-red-500'
            : isWarning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-800 dark:text-white';

    // 沙漏周围光晕颜色
    const glowColor = isFinished || isUrgent
        ? 'shadow-red-500/40'
        : isWarning
            ? 'shadow-amber-500/30'
            : 'shadow-primary/20';

    // DotLottie 实例回调 — 获取后暂停自动播放
    const handleDotLottieRef = useCallback((instance: DotLottie | null) => {
        dotLottieRef.current = instance;
        if (instance) {
            // 加载完成后暂停，由 setFrame 手动控制
            instance.addEventListener('load', () => {
                instance.pause();
                instance.setFrame(0);
            });
        }
    }, []);

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

                {/* 沙漏动画区域 */}
                <div className={`relative w-56 h-56 mb-4 rounded-3xl transition-shadow duration-500 ${totalSeconds > 0 ? `shadow-lg ${glowColor}` : ''}`}>
                    <div className={`w-full h-full transition-all ${!isRunning && !isFinished && totalSeconds === 0 ? 'opacity-40 grayscale' : ''} ${isFinished ? 'opacity-70' : ''}`}>
                        <DotLottieReact
                            src="/hourglass-loading.lottie"
                            autoplay={false}
                            loop={false}
                            dotLottieRefCallback={handleDotLottieRef}
                            renderConfig={{ autoResize: true }}
                            style={{ width: '100%', height: '100%' }}
                        />
                    </div>
                </div>

                {/* 倒计时数字 */}
                <div className="mb-8">
                    {totalSeconds > 0 ? (
                        <span className={`text-4xl font-black tabular-nums tracking-tight transition-colors ${timeColor}`}>
                            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </span>
                    ) : (
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">选择档位开始</span>
                    )}
                    {isFinished && (
                        <div className="text-center mt-1">
                            <span className="text-sm font-bold text-red-500 animate-pulse">时间到！</span>
                        </div>
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
