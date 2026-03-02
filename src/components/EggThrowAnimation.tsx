import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

interface EggThrowAnimationProps {
    targetUsername: string;
    onComplete: () => void;
}

/**
 * 扔鸡蛋趣味动画
 * 鸡蛋从底部飞向屏幕中央，碎裂后消失
 */
export default function EggThrowAnimation({ targetUsername, onComplete }: EggThrowAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const eggRef = useRef<HTMLDivElement>(null);
    const splatRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const egg = eggRef.current;
        const splat = splatRef.current;
        const text = textRef.current;
        const container = containerRef.current;
        if (!egg || !splat || !text || !container) return;

        // 背景淡入
        anime({
            targets: container,
            opacity: [0, 1],
            duration: 200,
            easing: 'easeOutQuad',
        });

        // 鸡蛋飞行
        anime({
            targets: egg,
            translateY: [300, 0],
            translateX: [anime.random(-50, 50), 0],
            rotate: [anime.random(-180, 180), 0],
            scale: [0.3, 1],
            opacity: [1, 1],
            duration: 500,
            easing: 'easeOutQuad',
            complete: () => {
                // 鸡蛋消失
                egg.style.display = 'none';
                // 碎裂效果出现
                splat.style.display = 'flex';
                anime({
                    targets: splat,
                    scale: [0.3, 1.2, 1],
                    opacity: [0, 1],
                    duration: 300,
                    easing: 'easeOutBack',
                });

                // 碎片飞散
                const particles = splat.querySelectorAll('.egg-particle');
                anime({
                    targets: particles,
                    translateX: () => anime.random(-120, 120),
                    translateY: () => anime.random(-120, 60),
                    rotate: () => anime.random(-360, 360),
                    scale: [1, 0],
                    opacity: [1, 0],
                    duration: 800,
                    delay: anime.stagger(30, { start: 200 }),
                    easing: 'easeOutCubic',
                });

                // 文字弹出
                anime({
                    targets: text,
                    scale: [0, 1.3, 1],
                    opacity: [0, 1],
                    duration: 400,
                    delay: 200,
                    easing: 'easeOutBack',
                });

                // 整体淡出
                setTimeout(() => {
                    anime({
                        targets: container,
                        opacity: 0,
                        duration: 400,
                        easing: 'easeInQuad',
                        complete: onComplete,
                    });
                }, 1200);
            },
        });
    }, [onComplete]);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none" style={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" />

            {/* 飞行中的鸡蛋 */}
            <div ref={eggRef} className="relative z-10 text-7xl">
                🥚
            </div>

            {/* 碎裂效果 */}
            <div ref={splatRef} className="absolute z-10 flex-col items-center gap-2" style={{ display: 'none' }}>
                {/* 蛋液 */}
                <div className="text-8xl">🍳</div>
                {/* 碎片粒子 */}
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className="egg-particle absolute"
                        style={{
                            fontSize: ['16px', '20px', '14px'][i % 3],
                            top: '50%',
                            left: '50%',
                        }}
                    >
                        {['💥', '✨', '🥚', '💫', '⭐'][i % 5]}
                    </div>
                ))}
            </div>

            {/* 弹出文字 */}
            <div ref={textRef} className="absolute z-20 mt-28 flex flex-col items-center" style={{ opacity: 0 }}>
                <p className="text-white text-xl font-black drop-shadow-lg">
                    砸中了 {targetUsername}！
                </p>
            </div>
        </div>
    );
}
