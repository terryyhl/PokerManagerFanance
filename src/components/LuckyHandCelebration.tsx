import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import anime from 'animejs/lib/anime.es.js';
import HandComboDisp from './HandComboDisp';

interface LuckyHandCelebrationProps {
    /** 中奖的手牌组合，如 "AKs" */
    combo: string;
    /** 中奖者昵称 */
    username: string;
    /** 新的命中次数 */
    hitCount: number;
    /** 动画结束后回调 */
    onComplete: () => void;
}

/** 全屏庆祝动画 — 幸运手牌命中时展示 */
export default function LuckyHandCelebration({ combo, username, hitCount, onComplete }: LuckyHandCelebrationProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const confettiRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = overlayRef.current;
        if (!el) return;

        // 1. 背景淡入
        anime({
            targets: el,
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad',
        });

        // 2. 中央卡片弹入
        anime({
            targets: '.celebration-card',
            scale: [0.3, 1],
            opacity: [0, 1],
            duration: 600,
            delay: 150,
            easing: 'easeOutBack',
        });

        // 3. 图标旋转闪耀
        anime({
            targets: '.celebration-star',
            rotate: [0, 360],
            scale: [0.5, 1.2, 1],
            duration: 1000,
            delay: 300,
            easing: 'easeOutElastic(1, .5)',
        });

        // 4. 文字逐行弹入
        anime({
            targets: '.celebration-text',
            translateY: [30, 0],
            opacity: [0, 1],
            duration: 500,
            delay: anime.stagger(100, { start: 400 }),
            easing: 'easeOutExpo',
        });

        // 5. 撒彩纸粒子
        if (confettiRef.current) {
            const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FF9F43', '#A55EEA', '#26DE81', '#FC5C65'];
            const container = confettiRef.current;
            const particles: HTMLDivElement[] = [];

            for (let i = 0; i < 60; i++) {
                const p = document.createElement('div');
                const size = Math.random() * 8 + 4;
                const color = colors[Math.floor(Math.random() * colors.length)];
                const isCircle = Math.random() > 0.5;

                p.style.cssText = `
                    position:absolute;
                    width:${size}px;
                    height:${isCircle ? size : size * 2.5}px;
                    background:${color};
                    border-radius:${isCircle ? '50%' : '2px'};
                    left:50%;
                    top:40%;
                    opacity:0;
                `;
                container.appendChild(p);
                particles.push(p);
            }

            anime({
                targets: particles,
                translateX: () => anime.random(-200, 200),
                translateY: () => anime.random(-300, 300),
                rotate: () => anime.random(-720, 720),
                opacity: [{ value: 1, duration: 100 }, { value: 0, duration: 800, delay: 600 }],
                scale: [0, () => anime.random(8, 14) / 10],
                duration: 1500,
                delay: anime.stagger(15, { start: 200 }),
                easing: 'easeOutExpo',
            });
        }

        // 6. hit_count 数字弹跳
        anime({
            targets: '.celebration-count',
            scale: [0, 1.5, 1],
            opacity: [0, 1],
            duration: 800,
            delay: 700,
            easing: 'easeOutElastic(1, .4)',
        });

        // 7. 整体退出
        const exitTimer = setTimeout(() => {
            anime({
                targets: el,
                opacity: [1, 0],
                scale: [1, 1.05],
                duration: 400,
                easing: 'easeInQuad',
                complete: onComplete,
            });
        }, 2800);

        return () => clearTimeout(exitTimer);
    }, [onComplete]);

    const content = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[300] flex items-center justify-center"
            style={{ opacity: 0 }}
            onClick={onComplete}
        >
            {/* 背景遮罩 + 径向渐变光辉 */}
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute inset-0" style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.25) 0%, transparent 60%)'
            }} />

            {/* 彩纸容器 */}
            <div ref={confettiRef} className="absolute inset-0 pointer-events-none overflow-hidden" />

            {/* 中央卡片 */}
            <div className="celebration-card relative z-10 flex flex-col items-center gap-4 px-8 py-8 rounded-3xl"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,215,0,0.15) 0%, rgba(255,255,255,0.05) 50%, rgba(255,215,0,0.1) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    boxShadow: '0 0 80px rgba(255,215,0,0.3), inset 0 0 30px rgba(255,215,0,0.05)',
                }}
            >
                {/* 星星图标 */}
                <div className="celebration-star">
                    <span className="material-symbols-outlined text-[56px] text-yellow-400"
                        style={{ fontVariationSettings: "'FILL' 1", filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.8))' }}>
                        celebration
                    </span>
                </div>

                {/* 手牌展示 */}
                <div className="celebration-text">
                    <HandComboDisp combo={combo} card2="" />
                </div>

                {/* 中奖文字 */}
                <div className="celebration-text text-center">
                    <p className="text-yellow-300 text-2xl font-black tracking-wide"
                        style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
                        幸运手牌命中!
                    </p>
                </div>

                <div className="celebration-text text-center">
                    <p className="text-white/80 text-sm font-medium">
                        {username} 命中了 <span className="text-yellow-300 font-bold">{combo}</span>
                    </p>
                </div>

                {/* 命中次数 */}
                <div className="celebration-count flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full px-5 py-2">
                    <span className="material-symbols-outlined text-yellow-400 text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        workspace_premium
                    </span>
                    <span className="text-yellow-300 text-lg font-black">x{hitCount}</span>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
