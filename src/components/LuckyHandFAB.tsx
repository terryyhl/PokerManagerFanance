import React, { useState, useEffect, useRef, useCallback } from 'react';
import anime from 'animejs';
import HandComboDisp from './HandComboDisp';

export interface LuckyHandData {
    hand_index: number;
    card_1: string;
    card_2: string;
    hit_count: number;
}

interface LuckyHandFABProps {
    maxHandsCount: number; // 0-3
    configuredHands: LuckyHandData[];
    onSelectSlot: (handIndex: number, action: 'setup' | 'hit') => void;
    onLongPressMain?: () => void;
}

export default function LuckyHandFAB({
    maxHandsCount,
    configuredHands,
    onSelectSlot,
    onLongPressMain
}: LuckyHandFABProps) {
    if (maxHandsCount === 0) return null;

    const [isExpanded, setIsExpanded] = useState(false);
    const [mainPressTimer, setMainPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isMainLongPressing, setIsMainLongPressing] = useState(false);

    const mainBtnRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const animatingRef = useRef(false);

    // 展开/收起动画
    useEffect(() => {
        if (animatingRef.current) return;
        animatingRef.current = true;

        const mainBtn = mainBtnRef.current;
        const backdrop = backdropRef.current;
        const items = document.querySelectorAll('.lucky-hand-item');
        const itemCount = items.length;

        if (isExpanded) {
            // ── 展开动画 ──────────────────────────────────────

            // 主按钮：弹性旋转 + 缩小 + 换色脉冲
            if (mainBtn) {
                anime.remove(mainBtn);
                anime({
                    targets: mainBtn,
                    rotate: [0, 135],
                    scale: [1, 0.88],
                    duration: 450,
                    easing: 'easeOutBack',
                });
                // 脉冲光环
                const ring = mainBtn.querySelector('.fab-ring');
                if (ring) {
                    anime({
                        targets: ring,
                        scale: [0.8, 1.6],
                        opacity: [0.6, 0],
                        duration: 600,
                        easing: 'easeOutQuad',
                    });
                }
            }

            // 背景遮罩淡入
            if (backdrop) {
                backdrop.style.pointerEvents = 'auto';
                anime({ targets: backdrop, opacity: [0, 1], duration: 300, easing: 'easeOutQuad' });
            }

            // 子按钮：弹性扇形弹出 + 旋转入场
            anime({
                targets: '.lucky-hand-item',
                translateX: (_el: Element, i: number, l: number) => {
                    const angle = l === 1 ? -135 : -180 + (90 / (l - 1)) * i;
                    const rad = (angle * Math.PI) / 180;
                    return Math.cos(rad) * 120;
                },
                translateY: (_el: Element, i: number, l: number) => {
                    const angle = l === 1 ? -135 : -180 + (90 / (l - 1)) * i;
                    const rad = (angle * Math.PI) / 180;
                    return Math.sin(rad) * 120;
                },
                opacity: [0, 1],
                scale: [0, 1],
                rotate: ['-45deg', '0deg'],
                duration: 500,
                delay: anime.stagger(60, { start: 80 }),
                easing: 'spring(1, 80, 12, 0)',
                complete: () => { animatingRef.current = false; },
            });
        } else {
            // ── 收起动画 ──────────────────────────────────────

            // 主按钮旋回 + 恢复大小
            if (mainBtn) {
                anime.remove(mainBtn);
                anime({
                    targets: mainBtn,
                    rotate: [135, 0],
                    scale: [0.88, 1],
                    duration: 350,
                    easing: 'easeOutQuad',
                });
            }

            // 子按钮快速吸回中心 + 旋转
            anime({
                targets: '.lucky-hand-item',
                translateX: 0,
                translateY: 0,
                opacity: 0,
                scale: 0,
                rotate: '45deg',
                duration: 250,
                delay: anime.stagger(30, { direction: 'reverse' }),
                easing: 'easeInBack',
                complete: () => { animatingRef.current = false; },
            });

            // 背景遮罩淡出
            if (backdrop) {
                anime({
                    targets: backdrop,
                    opacity: 0,
                    duration: 250,
                    easing: 'easeInQuad',
                    complete: () => { backdrop.style.pointerEvents = 'none'; },
                });
            }
        }
    }, [isExpanded]);

    // 渲染已配置槽位的牌面摘要
    const renderCardSummary = (c1: string, c2: string, hitCount: number) => {
        return (
            <div className="flex flex-col items-center justify-center leading-tight h-full w-full relative">
                <HandComboDisp combo={c1} card2={c2} compact className="[&_span]:text-sm [&_span]:px-1 [&_span]:py-0.5" />
                {hitCount > 0 && (
                    <div className="absolute -top-2.5 -right-2.5 bg-yellow-400 text-yellow-900 border-2 border-indigo-600 text-[10px] font-black w-5 h-5 rounded-full shadow-md flex items-center justify-center">
                        {hitCount}
                    </div>
                )}
            </div>
        );
    }

    const slots = Array.from({ length: maxHandsCount }, (_, i) => i + 1);

    return (
        <>
            {/* 遮罩层 — 独立于 FAB 容器，确保覆盖整个屏幕可点击 */}
            <div
                ref={backdropRef}
                className="fixed inset-0 z-40 bg-black/25"
                style={{ opacity: 0, pointerEvents: 'none' }}
                onClick={() => setIsExpanded(false)}
            />

            <div className="fixed bottom-24 right-6 z-50 flex items-center justify-center select-none">
                {/* 隐藏的子菜单，absolute 叠加在主按钮上，依靠动画四周上浮 */}
                <div className="absolute flex items-center justify-center pointer-events-none">
                    {slots.map((slotIndex) => {
                        const configured = configuredHands.find(h => h.hand_index === slotIndex);

                        return (
                            <div
                                key={slotIndex}
                                onClick={() => {
                                    if (!isExpanded) return;
                                    onSelectSlot(slotIndex, configured ? 'hit' : 'setup');
                                    setIsExpanded(false);
                                }}
                                className={`lucky-hand-item absolute w-[4.5rem] h-[4.5rem] rounded-2xl shadow-lg flex items-center justify-center cursor-pointer pointer-events-auto active:scale-95 ${configured
                                    ? 'bg-indigo-600 text-white border-2 border-indigo-400 shadow-indigo-500/30'
                                    : 'bg-slate-700 text-slate-300 border-2 border-dashed border-slate-500'
                                    }`}
                                style={{ opacity: 0, transform: 'scale(0) rotate(-45deg)' }}
                            >
                                {configured
                                    ? renderCardSummary(configured.card_1, configured.card_2, configured.hit_count)
                                    : (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="material-symbols-outlined text-[20px]">add</span>
                                            <span className="text-[9px] font-bold opacity-70">#{slotIndex}</span>
                                        </div>
                                    )
                                }
                            </div>
                        );
                    })}
                </div>

                {/* 主按钮 */}
                <div
                    ref={mainBtnRef}
                    onPointerDown={() => {
                        if (onLongPressMain) {
                            setIsMainLongPressing(false);
                            const timer = setTimeout(() => {
                                setIsMainLongPressing(true);
                                if (navigator.vibrate) navigator.vibrate(50);
                                onLongPressMain();
                            }, 500);
                            setMainPressTimer(timer);
                        }
                    }}
                    onPointerUp={() => {
                        if (mainPressTimer) clearTimeout(mainPressTimer);
                        if (!isMainLongPressing) {
                            setIsExpanded(!isExpanded);
                        }
                        setIsMainLongPressing(false);
                    }}
                    onPointerLeave={() => {
                        if (mainPressTimer) clearTimeout(mainPressTimer);
                        setIsMainLongPressing(false);
                    }}
                    onPointerCancel={() => {
                        if (mainPressTimer) clearTimeout(mainPressTimer);
                        setIsMainLongPressing(false);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); }}
                    className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center cursor-pointer relative z-10 bg-gradient-to-tr from-indigo-500 to-purple-500"
                >
                    {/* 脉冲光环 — 展开时播放一次 */}
                    <div className="fab-ring absolute inset-0 rounded-full bg-indigo-400 opacity-0 pointer-events-none" />

                    <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isExpanded ? 'close' : 'playing_cards'}
                    </span>

                    {/* 角标：有命中显示火焰+命中数，仅配置未命中显示配置数 */}
                    {!isExpanded && configuredHands.length > 0 && (() => {
                        const totalHits = configuredHands.reduce((sum, h) => sum + h.hit_count, 0);
                        return (
                            <div className={`absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ring-2 ring-indigo-500 ${totalHits > 0 ? 'bg-amber-400 text-amber-900' : 'bg-indigo-400 text-white'}`}>
                                {totalHits > 0 ? totalHits : configuredHands.length}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </>
    );
}
