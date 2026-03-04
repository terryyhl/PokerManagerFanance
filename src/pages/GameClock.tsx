import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const PRESETS = [
    { label: '30s', seconds: 30 },
    { label: '1', seconds: 60 },
    { label: '2', seconds: 120 },
    { label: '3', seconds: 180 },
];

/**
 * 沙漏沙量遮罩 —— 覆盖在 Lottie 动画上方，用半透明遮罩模拟沙量变化
 * progress: 1(满) → 0(空)
 *
 * 原理：沙漏上半部分的沙随时间减少，下半部分的沙随时间增加
 * - 上半遮罩：从顶部向下扩展，遮住"已流走"的部分
 * - 下半遮罩：从底部向上收缩，露出"已流入"的部分
 */
function SandMask({ progress }: { progress: number }) {
    // 沙漏在容器中的大致位置比例（根据 lottie 实际渲染微调）
    // 沙漏上半沙区域 ≈ 容器 15%~45%，下半沙区域 ≈ 容器 55%~85%
    const topStart = 15;   // 上半沙区起始 %
    const topEnd = 45;     // 上半沙区结束 %（中线）
    const botStart = 55;   // 下半沙区起始 %
    const botEnd = 85;     // 下半沙区结束 %

    const topRange = topEnd - topStart;   // 30%
    const botRange = botEnd - botStart;   // 30%

    // 上半：progress=1 时无遮罩(沙满)，progress=0 时全遮(沙空)
    const topMaskHeight = topRange * (1 - progress);  // 0→30%
    const topMaskTop = topStart;                       // 从顶部开始

    // 下半：progress=1 时全遮(下方空)，progress=0 时无遮罩(下方满)
    const botMaskHeight = botRange * progress;         // 30%→0%
    const botMaskBottom = 100 - botEnd;                // 从底部开始

    return (
        <>
            {/* 上半遮罩 — 遮住已流走的沙 */}
            <div
                className="absolute left-[10%] right-[10%] pointer-events-none transition-all duration-1000 ease-linear"
                style={{
                    top: `${topMaskTop}%`,
                    height: `${topMaskHeight}%`,
                    background: 'linear-gradient(to bottom, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.3))',
                    borderRadius: '0 0 40% 40%',
                }}
            />
            {/* 下半遮罩 — 遮住尚未流入的空间 */}
            <div
                className="absolute left-[10%] right-[10%] pointer-events-none transition-all duration-1000 ease-linear"
                style={{
                    bottom: `${botMaskBottom}%`,
                    height: `${botMaskHeight}%`,
                    background: 'linear-gradient(to top, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.3))',
                    borderRadius: '40% 40% 0 0',
                }}
            />
        </>
    );
}

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

    // SVG 圆环参数
    const R = 108;
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
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">牌局时钟</h1>
                <span className="material-symbols-outlined text-[24px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 圆环 + 沙漏 组合区域 */}
                <div className="relative w-64 h-64 mb-6">
                    {/* SVG 圆环进度 */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
                        {/* 背景轨道 */}
                        <circle
                            cx="120" cy="120" r={R}
                            fill="none"
                            strokeWidth="5"
                            className="stroke-slate-200 dark:stroke-slate-800"
                        />
                        {/* 进度弧 */}
                        {totalSeconds > 0 && (
                            <circle
                                cx="120" cy="120" r={R}
                                fill="none"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - progress)}
                                className={`transition-all duration-1000 ease-linear ${ringColor}`}
                            />
                        )}
                    </svg>

                    {/* 沙漏 Lottie 动画（循环装饰） + 沙量遮罩 */}
                    <div className="absolute inset-[14px] rounded-full overflow-hidden">
                        <div className={`relative w-full h-full transition-all ${!isRunning && !isFinished && totalSeconds === 0 ? 'opacity-40 grayscale' : ''} ${isFinished ? 'opacity-60' : ''}`}>
                            <DotLottieReact
                                src="/hourglass-loading.lottie"
                                autoplay
                                loop
                                renderConfig={{ autoResize: true }}
                                style={{ width: '100%', height: '100%' }}
                            />
                            {/* 沙量遮罩 — 仅在倒计时进行中显示 */}
                            {totalSeconds > 0 && <SandMask progress={progress} />}
                        </div>
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
