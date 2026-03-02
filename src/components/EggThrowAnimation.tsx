import React, { useEffect, useRef } from 'react';
import anime from 'animejs';
import Avatar from './Avatar';

interface EggThrowAnimationProps {
    targetUsername: string;
    targetRect: DOMRect; // 目标头像在屏幕上的位置
    onComplete: () => void;
}

/**
 * 扔鸡蛋趣味动画
 * 鸡蛋从屏幕中心飞向目标头像，碎裂后消失
 */
export default function EggThrowAnimation({ targetUsername, targetRect, onComplete }: EggThrowAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const eggRef = useRef<HTMLDivElement>(null);
    const splatRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLDivElement>(null);

    // 目标位置（头像中心）
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    useEffect(() => {
        const egg = eggRef.current;
        const splat = splatRef.current;
        const text = textRef.current;
        const container = containerRef.current;
        const avatar = avatarRef.current;
        if (!egg || !splat || !text || !container || !avatar) return;

        // 背景淡入
        anime({
            targets: container,
            opacity: [0, 1],
            duration: 150,
            easing: 'easeOutQuad',
        });

        // 头像抖动提示
        anime({
            targets: avatar,
            scale: [0, 1],
            opacity: [0, 1],
            duration: 200,
            easing: 'easeOutBack',
        });

        // 鸡蛋从屏幕中心飞向目标头像
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight / 2;

        egg.style.left = `${startX}px`;
        egg.style.top = `${startY}px`;

        anime({
            targets: egg,
            left: [startX, targetX],
            top: [startY, targetY],
            rotate: [0, anime.random(-360, 360)],
            scale: [0.6, 1.2],
            duration: 400,
            easing: 'easeInQuad',
            complete: () => {
                // 鸡蛋消失
                egg.style.display = 'none';

                // 头像震动
                anime({
                    targets: avatar,
                    translateX: [0, -8, 8, -6, 6, -3, 3, 0],
                    duration: 400,
                    easing: 'easeInOutQuad',
                });

                // 碎裂效果出现（在目标位置）
                splat.style.display = 'flex';
                anime({
                    targets: splat,
                    scale: [0.3, 1.3, 1],
                    opacity: [0, 1],
                    duration: 250,
                    easing: 'easeOutBack',
                });

                // 碎片飞散
                const particles = splat.querySelectorAll('.egg-particle');
                anime({
                    targets: particles,
                    translateX: () => anime.random(-80, 80),
                    translateY: () => anime.random(-80, 40),
                    rotate: () => anime.random(-360, 360),
                    scale: [1, 0],
                    opacity: [1, 0],
                    duration: 600,
                    delay: anime.stagger(20, { start: 100 }),
                    easing: 'easeOutCubic',
                });

                // 文字弹出
                anime({
                    targets: text,
                    scale: [0, 1.2, 1],
                    opacity: [0, 1],
                    duration: 300,
                    delay: 150,
                    easing: 'easeOutBack',
                });

                // 整体淡出
                setTimeout(() => {
                    anime({
                        targets: container,
                        opacity: 0,
                        duration: 300,
                        easing: 'easeInQuad',
                        complete: onComplete,
                    });
                }, 1000);
            },
        });
    }, [onComplete, targetX, targetY]);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[200] pointer-events-none" style={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" />

            {/* 目标头像高亮（在原位置显示） */}
            <div
                ref={avatarRef}
                className="absolute z-10 rounded-full ring-4 ring-red-500/60 shadow-2xl overflow-hidden"
                style={{
                    left: targetRect.left,
                    top: targetRect.top,
                    width: targetRect.width,
                    height: targetRect.height,
                    opacity: 0,
                }}
            >
                <Avatar username={targetUsername} />
            </div>

            {/* 飞行中的鸡蛋 — absolute 定位，由 anime 控制 left/top */}
            <div
                ref={eggRef}
                className="absolute z-20 text-5xl -translate-x-1/2 -translate-y-1/2"
            >
                🥚
            </div>

            {/* 碎裂效果 — 定位在目标头像处 */}
            <div
                ref={splatRef}
                className="absolute z-20 flex-col items-center gap-2 -translate-x-1/2 -translate-y-1/2"
                style={{ display: 'none', left: targetX, top: targetY }}
            >
                <div className="text-6xl">🍳</div>
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className="egg-particle absolute"
                        style={{
                            fontSize: ['14px', '16px', '12px'][i % 3],
                            top: '50%',
                            left: '50%',
                        }}
                    >
                        {['💥', '✨', '🥚', '💫', '⭐'][i % 5]}
                    </div>
                ))}
            </div>

            {/* 弹出文字 — 在目标头像下方 */}
            <div
                ref={textRef}
                className="absolute z-30 flex flex-col items-center -translate-x-1/2"
                style={{ opacity: 0, left: targetX, top: targetRect.bottom + 16 }}
            >
                <p className="text-white text-base font-black drop-shadow-lg bg-black/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    砸中了 {targetUsername}！
                </p>
            </div>
        </div>
    );
}
