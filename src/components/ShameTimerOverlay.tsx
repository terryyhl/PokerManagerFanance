import React, { useState, useEffect, useRef, useCallback } from 'react';
import anime from 'animejs';
import Avatar from './Avatar';

interface ShameTimerOverlayProps {
    targetUsername: string;
    targetUserId: string;
    startedByUsername: string;
    onStop: (durationSeconds: number) => void;
    onCancel: () => void;
}

/**
 * 思考计时器覆盖层
 * 正计时，显示被催促玩家头像 + 实时时钟
 * 可被所有人看到（通过 Realtime 同步）
 */
export default function ShameTimerOverlay({ targetUsername, targetUserId, startedByUsername, onStop, onCancel }: ShameTimerOverlayProps) {
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(Date.now());
    const containerRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);
    const pulseRef = useRef<HTMLDivElement>(null);

    // 进场动画
    useEffect(() => {
        if (containerRef.current) {
            anime({
                targets: containerRef.current,
                opacity: [0, 1],
                duration: 300,
                easing: 'easeOutQuad',
            });
        }
        if (clockRef.current) {
            anime({
                targets: clockRef.current,
                scale: [0.5, 1],
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutBack',
                delay: 150,
            });
        }
    }, []);

    // 脉冲动画
    useEffect(() => {
        if (pulseRef.current) {
            anime({
                targets: pulseRef.current,
                scale: [1, 1.8],
                opacity: [0.6, 0],
                duration: 1500,
                easing: 'easeOutQuad',
                loop: true,
            });
        }
    }, []);

    // 正计时
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    const formatTime = useCallback((seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    const handleStop = () => {
        onStop(elapsed);
    };

    // 根据时长决定颜色强度
    const urgencyColor = elapsed < 15 ? 'text-amber-400' : elapsed < 30 ? 'text-orange-500' : 'text-red-500';
    const urgencyBg = elapsed < 15 ? 'from-amber-500/20' : elapsed < 30 ? 'from-orange-500/20' : 'from-red-500/20';
    const urgencyRing = elapsed < 15 ? 'ring-amber-400/40' : elapsed < 30 ? 'ring-orange-500/40' : 'ring-red-500/40';
    const urgencyLabel = elapsed < 15 ? '思考中...' : elapsed < 30 ? '有点慢了...' : elapsed < 60 ? '快点啊！' : '睡着了？！';

    return (
        <div ref={containerRef} className="fixed inset-0 z-[150] flex items-center justify-center" style={{ opacity: 0 }}>
            {/* 背景 */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div ref={clockRef} className="relative flex flex-col items-center gap-6 z-10" style={{ opacity: 0 }}>
                {/* 被计时玩家头像 + 脉冲环 */}
                <div className="relative">
                    <div ref={pulseRef} className={`absolute inset-0 rounded-full ${urgencyRing} ring-[3px]`} />
                    <div className={`w-20 h-20 rounded-full overflow-hidden ring-4 ${urgencyRing} shadow-2xl`}>
                        <Avatar username={targetUsername} />
                    </div>
                </div>

                {/* 玩家名 */}
                <div className="text-center">
                    <p className="text-white text-lg font-bold">{targetUsername}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{urgencyLabel}</p>
                </div>

                {/* 大计时器数字 */}
                <div className={`bg-gradient-to-b ${urgencyBg} to-transparent px-10 py-5 rounded-3xl`}>
                    <p className={`text-6xl font-black tracking-wider font-mono ${urgencyColor} tabular-nums`}>
                        {formatTime(elapsed)}
                    </p>
                </div>

                {/* 发起者信息 */}
                <p className="text-slate-500 text-xs">
                    由 <span className="text-slate-300 font-bold">{startedByUsername}</span> 发起催促
                </p>

                {/* 操作按钮 */}
                <div className="flex items-center gap-4 mt-2">
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all active:scale-95"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleStop}
                        className="px-8 py-3 rounded-xl bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                        停止计时 ({elapsed}s)
                    </button>
                </div>
            </div>
        </div>
    );
}
