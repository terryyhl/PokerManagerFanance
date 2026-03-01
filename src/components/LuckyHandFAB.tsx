import React, { useState, useEffect } from 'react';
import anime from 'animejs';
import PokerCardDisp from './PokerCardDisp';

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

    // 展开/收起动画
    useEffect(() => {
        if (isExpanded) {
            anime({
                targets: '.lucky-hand-item',
                translateX: (el: any, i: number, l: number) => {
                    // 计算按扇形分散的角度 (从 180度[左] 到 270度[上])
                    const angle = l === 1 ? -135 : -180 + (90 / (l - 1)) * i;
                    const rad = (angle * Math.PI) / 180;
                    return Math.cos(rad) * 90; // 半径 90px
                },
                translateY: (el: any, i: number, l: number) => {
                    const angle = l === 1 ? -135 : -180 + (90 / (l - 1)) * i;
                    const rad = (angle * Math.PI) / 180;
                    return Math.sin(rad) * 90;
                },
                opacity: [0, 1],
                scale: [0.5, 1],
                duration: 300,
                delay: anime.stagger(30),
                easing: 'easeOutCubic',
            });
        } else {
            anime({
                targets: '.lucky-hand-item',
                translateX: 0,
                translateY: 0,
                opacity: 0,
                scale: 0.5,
                duration: 200,
                easing: 'easeInQuad',
            });
        }
    }, [isExpanded]);

    // 渲染单张扑克小图标（用来在已配置手牌槽位上显示）
    const renderCardSummary = (c1: string, c2: string, hitCount: number) => {
        return (
            <div className="flex flex-col items-center justify-center p-1 leading-tight h-full w-full relative">
                <div className="flex gap-0.5 justify-center w-full">
                    <PokerCardDisp card={c1} className="text-[14px] px-1 py-0 shadow-sm" />
                    <PokerCardDisp card={c2} className="text-[14px] px-1 py-0 shadow-sm" />
                </div>
                {hitCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 border-2 border-indigo-600 text-[10px] font-black w-5 h-5 rounded-full shadow-sm flex items-center justify-center">
                        {hitCount}
                    </div>
                )}
            </div>
        );
    }

    const slots = Array.from({ length: maxHandsCount }, (_, i) => i + 1);

    return (
        <div className="fixed bottom-24 right-6 z-50 flex items-center justify-center select-none">
            {/* 点击空白处收起 */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-[-1]"
                    onClick={() => setIsExpanded(false)}
                />
            )}

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
                            className={`lucky-hand-item absolute w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer pointer-events-auto transition-transform hover:scale-110 active:scale-95 ${configured
                                ? 'bg-indigo-600 text-white border-2 border-indigo-400'
                                : 'bg-slate-700 text-slate-300 border-2 border-dashed border-slate-500 hover:bg-slate-600'
                                }`}
                            style={{ opacity: 0, transform: 'scale(0.5)' }} // 初始隐藏
                        >
                            {configured
                                ? renderCardSummary(configured.card_1, configured.card_2, configured.hit_count)
                                : <span className="material-symbols-outlined text-[24px]">add</span>
                            }
                        </div>
                    );
                })}
            </div>

            {/* 主按钮 */}
            <div
                onPointerDown={() => {
                    if (onLongPressMain) {
                        setIsMainLongPressing(false);
                        const timer = setTimeout(() => {
                            setIsMainLongPressing(true);
                            if (navigator.vibrate) navigator.vibrate(50);
                            onLongPressMain();
                        }, 500); // 500ms 判定为长按呼出电视墙
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
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform cursor-pointer relative z-10
                ${isExpanded ? 'bg-indigo-600 scale-90' : 'bg-gradient-to-tr from-indigo-500 to-purple-500 hover:scale-105 active:scale-95'}`}
            >
                <span className={`material-symbols-outlined text-white text-[28px] transition-transform duration-300 ${isExpanded ? 'rotate-45' : ''}`}>
                    {isExpanded ? 'close' : 'playing_cards'}
                </span>

                {/* 提示角标 */}
                {!isExpanded && configuredHands.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-md ring-2 ring-indigo-500">
                        {configuredHands.reduce((sum, h) => sum + h.hit_count, 0) || configuredHands.length}
                    </div>
                )}
            </div>

            {!isExpanded && (
                <div className="absolute -top-8 right-0 bg-black/50 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-60">
                    点击配置手牌
                </div>
            )}
        </div>
    );
}
