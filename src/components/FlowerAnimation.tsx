import React, { useEffect, useRef } from 'react';
import anime from 'animejs';
import Avatar from './Avatar';

interface FlowerAnimationProps {
    targetUsername: string;
    targetRect: DOMRect;
    onComplete: () => void;
}

/**
 * 送鲜花趣味动画
 * 一束玫瑰从屏幕底部飞向目标头像，花瓣散落
 */
export default function FlowerAnimation({ targetUsername, targetRect, onComplete }: FlowerAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const flowerRef = useRef<HTMLDivElement>(null);
    const burstRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLDivElement>(null);

    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    useEffect(() => {
        const flower = flowerRef.current;
        const burst = burstRef.current;
        const text = textRef.current;
        const container = containerRef.current;
        const avatar = avatarRef.current;
        if (!flower || !burst || !text || !container || !avatar) return;

        // 背景淡入
        anime({ targets: container, opacity: [0, 1], duration: 150, easing: 'easeOutQuad' });

        // 头像高亮
        anime({ targets: avatar, scale: [0, 1], opacity: [0, 1], duration: 200, easing: 'easeOutBack' });

        // 鲜花从屏幕底部飞向目标
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight + 50;

        flower.style.left = `${startX}px`;
        flower.style.top = `${startY}px`;

        anime({
            targets: flower,
            left: [startX, targetX],
            top: [startY, targetY],
            rotate: [0, -15],
            scale: [0.8, 1.3],
            duration: 500,
            easing: 'easeInOutQuad',
            complete: () => {
                flower.style.display = 'none';

                // 头像弹跳
                anime({
                    targets: avatar,
                    scale: [1, 1.2, 1],
                    duration: 400,
                    easing: 'easeOutBack',
                });

                // 花瓣散落
                burst.style.display = 'block';
                anime({
                    targets: burst,
                    scale: [0.3, 1],
                    opacity: [0, 1],
                    duration: 200,
                    easing: 'easeOutBack',
                });

                const petals = burst.querySelectorAll('.petal');
                anime({
                    targets: petals,
                    translateX: () => anime.random(-100, 100),
                    translateY: () => anime.random(-100, 60),
                    rotate: () => anime.random(-180, 180),
                    scale: [1, 0],
                    opacity: [1, 0],
                    duration: 800,
                    delay: anime.stagger(30, { start: 100 }),
                    easing: 'easeOutCubic',
                });

                // 文字
                anime({
                    targets: text,
                    scale: [0, 1.2, 1],
                    opacity: [0, 1],
                    duration: 300,
                    delay: 150,
                    easing: 'easeOutBack',
                });

                // 淡出
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

            {/* 目标头像高亮 */}
            <div
                ref={avatarRef}
                className="absolute z-10 rounded-full ring-4 ring-pink-400/60 shadow-2xl overflow-hidden"
                style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height, opacity: 0 }}
            >
                <Avatar username={targetUsername} />
            </div>

            {/* 飞行中的鲜花 */}
            <div
                ref={flowerRef}
                className="absolute z-20 text-5xl -translate-x-1/2 -translate-y-1/2"
            >
                🌹
            </div>

            {/* 花瓣散落效果 */}
            <div
                ref={burstRef}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ display: 'none', left: targetX, top: targetY }}
            >
                <div className="text-5xl">💐</div>
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className="petal absolute"
                        style={{ fontSize: ['14px', '18px', '12px', '16px'][i % 4], top: '50%', left: '50%' }}
                    >
                        {['🌸', '🌺', '💖', '✨', '🌷', '💕'][i % 6]}
                    </div>
                ))}
            </div>

            {/* 文字 */}
            <div
                ref={textRef}
                className="absolute z-30 flex flex-col items-center -translate-x-1/2"
                style={{ opacity: 0, left: targetX, top: targetRect.bottom + 16 }}
            >
                <p className="text-white text-base font-black drop-shadow-lg bg-black/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    送给 {targetUsername} 鲜花！
                </p>
            </div>
        </div>
    );
}
