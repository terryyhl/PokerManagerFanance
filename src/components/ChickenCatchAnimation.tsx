import React, { useEffect, useRef } from 'react';
import anime from 'animejs';
import Avatar from './Avatar';

interface ChickenCatchAnimationProps {
    targetUsername: string;
    targetRect: DOMRect;
    onComplete: () => void;
}

/**
 * 抓鸡趣味动画
 * 一只鸡从屏幕中心飞向目标头像，被网兜捕获
 */
export default function ChickenCatchAnimation({ targetUsername, targetRect, onComplete }: ChickenCatchAnimationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chickenRef = useRef<HTMLDivElement>(null);
    const netRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLDivElement>(null);
    const feathersRef = useRef<HTMLDivElement>(null);

    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    useEffect(() => {
        const chicken = chickenRef.current;
        const net = netRef.current;
        const text = textRef.current;
        const container = containerRef.current;
        const avatar = avatarRef.current;
        const feathers = feathersRef.current;
        if (!chicken || !net || !text || !container || !avatar || !feathers) return;

        // 背景淡入
        anime({ targets: container, opacity: [0, 1], duration: 150, easing: 'easeOutQuad' });

        // 头像高亮
        anime({ targets: avatar, scale: [0, 1], opacity: [0, 1], duration: 200, easing: 'easeOutBack' });

        // 鸡从屏幕中心飞向目标头像
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight / 2;

        chicken.style.left = `${startX}px`;
        chicken.style.top = `${startY}px`;
        chicken.style.display = 'block';

        anime({
            targets: chicken,
            left: [startX, targetX],
            top: [startY, targetY],
            rotate: [0, anime.random(-360, 360)],
            scale: [0.6, 1.3],
            duration: 450,
            easing: 'easeInOutQuad',
            complete: () => {
                // 网兜落下
                net.style.display = 'block';
                anime({
                    targets: net,
                    translateY: [-80, 0],
                    scale: [0.5, 1.2, 1],
                    opacity: [0, 1],
                    duration: 300,
                    easing: 'easeInQuad',
                    complete: () => {
                        // 鸡消失，变成羽毛飞散
                        chicken.style.display = 'none';
                        feathers.style.display = 'block';

                        const particles = feathers.querySelectorAll('.feather');
                        anime({
                            targets: particles,
                            translateX: () => anime.random(-100, 100),
                            translateY: () => anime.random(-80, 30),
                            rotate: () => anime.random(-180, 180),
                            scale: [1, 0],
                            opacity: [1, 0],
                            duration: 700,
                            delay: anime.stagger(30),
                            easing: 'easeOutCubic',
                        });

                        // 文字
                        anime({
                            targets: text,
                            scale: [0, 1.2, 1],
                            opacity: [0, 1],
                            duration: 300,
                            delay: 100,
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
            },
        });
    }, [onComplete, targetX, targetY]);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[200] pointer-events-none" style={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" />

            {/* 目标头像高亮 */}
            <div
                ref={avatarRef}
                className="absolute z-10 rounded-full ring-4 ring-yellow-500/60 shadow-2xl overflow-hidden"
                style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height, opacity: 0 }}
            >
                <Avatar username={targetUsername} />
            </div>

            {/* 鸡 */}
            <div
                ref={chickenRef}
                className="absolute z-20 text-5xl -translate-x-1/2 -translate-y-1/2"
                style={{ display: 'none' }}
            >
                🐔
            </div>

            {/* 网兜 */}
            <div
                ref={netRef}
                className="absolute z-30 text-5xl -translate-x-1/2 -translate-y-1/2"
                style={{ display: 'none', left: targetX, top: targetY + 20 }}
            >
                🪤
            </div>

            {/* 羽毛飞散 */}
            <div
                ref={feathersRef}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ display: 'none', left: targetX, top: targetY + 20 }}
            >
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="feather absolute" style={{ fontSize: ['14px', '18px', '12px'][i % 3], top: 0, left: 0 }}>
                        {['🪶', '✨', '💫', '🐣'][i % 4]}
                    </div>
                ))}
            </div>

            {/* 文字 */}
            <div
                ref={textRef}
                className="absolute z-30 flex flex-col items-center -translate-x-1/2"
                style={{ opacity: 0, left: targetX, top: targetRect.bottom + 20 }}
            >
                <p className="text-white text-base font-black drop-shadow-lg bg-black/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    抓到 {targetUsername} 的鸡了！
                </p>
            </div>
        </div>
    );
}
