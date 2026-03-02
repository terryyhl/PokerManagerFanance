import React, { useState, useEffect, useRef, useCallback } from 'react';
import anime from 'animejs';
import Avatar from './Avatar';

const PRESETS = [
    { label: '30s', seconds: 30 },
    { label: '1min', seconds: 60 },
    { label: '2min', seconds: 120 },
    { label: '3min', seconds: 180 },
];

interface ShameTimerOverlayProps {
    targetUsername: string;
    targetUserId: string;
    startedByUsername: string;
    /** 当前登录用户的 userId，用于判断文案视角 */
    currentUserId?: string;
    /** 发起者的 userId */
    startedByUserId?: string;
    onStop: (durationSeconds: number) => void;
    onCancel: () => void;
    /** 主持模式：用户选择预设后回调（用于广播 timer_start） */
    onTimerStarted?: (totalSeconds: number, startedAt: number) => void;
    /** 观看模式：只读显示倒计时，不可操作 */
    viewerMode?: boolean;
    /** viewer 模式下：计时器开始的时间戳 (Date.now()) */
    viewerStartedAt?: number;
    /** viewer 模式下：总计时秒数 */
    viewerTotalSeconds?: number;
}

/**
 * 催促倒计时器覆盖层
 * - 主持模式（默认）：选择预设时长后开始倒计时
 * - 观看模式（viewerMode）：只读显示从广播同步来的倒计时
 * 
 * 文案视角：
 * - 发起者自己看到: "我对 XX 的定时催促"
 * - 其他人看到: "XX 对 XX 的定时催促"
 */
export default function ShameTimerOverlay({
    targetUsername, targetUserId, startedByUsername,
    currentUserId, startedByUserId,
    onStop, onCancel, onTimerStarted,
    viewerMode = false, viewerStartedAt, viewerTotalSeconds,
}: ShameTimerOverlayProps) {
    const [totalSeconds, setTotalSeconds] = useState(viewerMode ? (viewerTotalSeconds || 0) : 0);
    const [remaining, setRemaining] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const pulseRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // viewer 模式：根据 startedAt 计算剩余时间
    useEffect(() => {
        if (!viewerMode || !viewerStartedAt || !viewerTotalSeconds) return;
        const total = viewerTotalSeconds;
        setTotalSeconds(total);

        const tick = () => {
            const elapsed = Math.floor((Date.now() - viewerStartedAt) / 1000);
            const left = Math.max(0, total - elapsed);
            setRemaining(left);
            if (left <= 0) {
                setIsRunning(false);
                setIsFinished(true);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            }
            return left;
        };

        const left = tick();
        if (left > 0) {
            setIsRunning(true);
            setIsFinished(false);
            const iv = setInterval(() => {
                const r = tick();
                if (r <= 0) clearInterval(iv);
            }, 1000);
            intervalRef.current = iv;
        } else {
            setIsFinished(true);
        }

        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [viewerMode, viewerStartedAt, viewerTotalSeconds]);

    // 进场动画
    useEffect(() => {
        if (containerRef.current) {
            anime({ targets: containerRef.current, opacity: [0, 1], duration: 200, easing: 'easeOutQuad' });
        }
        if (cardRef.current) {
            anime({ targets: cardRef.current, scale: [0.8, 1], opacity: [0, 1], duration: 300, easing: 'easeOutBack', delay: 100 });
        }
    }, []);

    // 脉冲动画（运行中）
    useEffect(() => {
        if (pulseRef.current && isRunning) {
            anime({ targets: pulseRef.current, scale: [1, 1.6], opacity: [0.5, 0], duration: 1200, easing: 'easeOutQuad', loop: true });
        }
    }, [isRunning]);

    // 主持模式：倒计时
    useEffect(() => {
        if (viewerMode) return; // viewer 模式用自己的计时逻辑
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
    }, [isRunning, remaining, viewerMode]);

    const handleSelectPreset = (secs: number) => {
        const now = Date.now();
        setTotalSeconds(secs);
        setRemaining(secs);
        setIsRunning(true);
        setIsFinished(false);
        onTimerStarted?.(secs, now);
    };

    const handleDone = () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        const elapsed = totalSeconds - remaining;
        onStop(elapsed > 0 ? elapsed : totalSeconds);
    };

    const handleCancelTimer = () => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        onCancel();
    };

    const formatTime = useCallback((seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    const progress = totalSeconds > 0 ? remaining / totalSeconds : 1;
    const urgencyColor = !isRunning && !isFinished ? 'text-slate-400'
        : isFinished ? 'text-red-500'
        : remaining <= 10 ? 'text-red-500'
        : remaining <= 30 ? 'text-orange-500'
        : 'text-amber-400';
    const ringColor = isFinished ? 'stroke-red-500'
        : remaining <= 10 ? 'stroke-red-500'
        : remaining <= 30 ? 'stroke-orange-500'
        : 'stroke-amber-400';

    const R = 70;
    const C = 2 * Math.PI * R;

    // 视角文案
    const isInitiator = currentUserId && startedByUserId && currentUserId === startedByUserId;
    const titleText = isInitiator
        ? `我对 ${targetUsername} 的定时催促`
        : `${startedByUsername} 对 ${targetUsername} 的定时催促`;

    return (
        <div ref={containerRef} className="fixed inset-0 z-[150] flex items-center justify-center" style={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCancelTimer} />

            <div ref={cardRef} className="relative z-10 flex flex-col items-center gap-5 bg-[#1a2632] rounded-3xl p-6 shadow-2xl ring-1 ring-white/10 w-[85vw] max-w-[320px]" style={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
                {/* 被催促玩家 */}
                <div className="relative">
                    {isRunning && <div ref={pulseRef} className="absolute inset-0 rounded-full ring-[3px] ring-amber-400/40" />}
                    <div className={`w-16 h-16 rounded-full overflow-hidden ring-4 ${isFinished ? 'ring-red-500/60' : isRunning ? 'ring-amber-400/40' : 'ring-slate-600'} shadow-xl`}>
                        <Avatar username={targetUsername} />
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-white text-sm font-bold leading-snug">{titleText}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                        {isFinished ? '时间到！' : isRunning ? '倒计时中...' : viewerMode ? '等待中...' : '选择倒计时'}
                    </p>
                </div>

                {/* 倒计时圆环 */}
                {(totalSeconds > 0 || viewerMode) && totalSeconds > 0 && (
                    <div className="relative w-40 h-40">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                            <circle cx="80" cy="80" r={R} fill="none" strokeWidth="5" className="stroke-slate-700" />
                            <circle cx="80" cy="80" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
                                strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                                className={`transition-all duration-1000 ease-linear ${ringColor}`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-4xl font-black font-mono tabular-nums ${urgencyColor} ${isFinished ? 'animate-pulse' : ''}`}>
                                {formatTime(remaining)}
                            </span>
                        </div>
                    </div>
                )}

                {/* 预设按钮（主持模式 + 未开始时显示） */}
                {!viewerMode && !isRunning && !isFinished && (
                    <div className="flex items-center gap-3">
                        {PRESETS.map(p => (
                            <button key={p.label} onClick={() => handleSelectPreset(p.seconds)}
                                className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-amber-500/50 text-slate-200 font-bold transition-all active:scale-95"
                            >
                                <span className="text-lg font-black">{p.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-3 w-full">
                    {viewerMode ? (
                        /* viewer 模式：只有关闭按钮 */
                        <button onClick={handleCancelTimer}
                            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-bold transition-all active:scale-95"
                        >关闭</button>
                    ) : (
                        /* 主持模式：取消 + 提前结束/完成 */
                        <>
                            <button onClick={handleCancelTimer}
                                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-bold transition-all active:scale-95"
                            >取消</button>
                            {(isRunning || isFinished) && (
                                <button onClick={handleDone}
                                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    {isFinished ? '完成' : '提前结束'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
