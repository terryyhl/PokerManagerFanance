import React, { useState, useRef, useEffect, useCallback } from 'react';
import anime from 'animejs';

export interface LuckyHandData {
    hand_index: number;
    card_1: string;
    card_2: string;
    hit_count: number;
}

interface LuckyHandFABProps {
    maxHandsCount: number; // 0-3
    configuredHands: LuckyHandData[]; // 此前已保存的手牌数据
    onSelectSlot: (handIndex: number, isConfigured: boolean) => void;
}

export default function LuckyHandFAB({
    maxHandsCount,
    configuredHands,
    onSelectSlot,
}: LuckyHandFABProps) {
    if (maxHandsCount === 0) return null;

    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingRef = useRef(false);

    // 用来存放子菜单按钮的 DOM 引用，方便做碰撞检测
    const menuItemsRef = useRef<(HTMLDivElement | null)[]>([]);

    // 展开动画
    useEffect(() => {
        if (isExpanded) {
            anime({
                targets: '.lucky-hand-item',
                translateY: (el: any, i: number) => -(i + 1) * 60,
                opacity: [0, 1],
                scale: [0.5, 1],
                duration: 400,
                delay: anime.stagger(50),
                easing: 'easeOutElastic(1, .8)',
            });
        } else {
            anime({
                targets: '.lucky-hand-item',
                translateY: 0,
                opacity: 0,
                scale: 0.5,
                duration: 200,
                easing: 'easeInQuad',
            });
            setHoveredIndex(null);
        }
    }, [isExpanded]);

    // 根据当前触出的客户端坐标，找到覆盖到的按钮索引 (1~maxHandsCount)
    const getHoveredIndex = useCallback((clientX: number, clientY: number): number | null => {
        if (!isExpanded) return null;
        let foundIndex: number | null = null;

        // 遍历这几个子菜单 DOM
        menuItemsRef.current.forEach((el, i) => {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            // 在其响应区域内 (放大一点点碰撞框增加手感)
            const padding = 20;
            if (
                clientX >= rect.left - padding &&
                clientX <= rect.right + padding &&
                clientY >= rect.top - padding &&
                clientY <= rect.bottom + padding
            ) {
                foundIndex = i + 1; // 1-based handIndex
            }
        });

        return foundIndex;
    }, [isExpanded]);

    // =============== 鼠标与触摸事件处理 =============== 

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return; // 只响应左键或触摸

        // 如果没有展开，启动长按判断
        if (!isExpanded) {
            isDraggingRef.current = false;
            pressTimerRef.current = setTimeout(() => {
                setIsExpanded(true);
                isDraggingRef.current = true;
                // 手机震动反馈
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500); // 长按 500ms 唤出
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isExpanded) {
            // 如果还没展开就已经移动了较远距离，说明他不是想长按而是想划屏幕，那就取消长按
            if (pressTimerRef.current) {
                clearTimeout(pressTimerRef.current);
                pressTimerRef.current = null;
            }
            return;
        }

        // 阻止页面滚动，让手指专心用于悬浮窗的手势检测
        try {
            if (e.cancelable) e.preventDefault();
        } catch { }

        const targetIndex = getHoveredIndex(e.clientX, e.clientY);
        setHoveredIndex(targetIndex);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
        }

        if (isExpanded) {
            const finalIndex = hoveredIndex || getHoveredIndex(e.clientX, e.clientY);

            if (finalIndex !== null && finalIndex >= 1 && finalIndex <= maxHandsCount) {
                // 用户松开了目标槽位！
                const isConfigured = configuredHands.some(h => h.hand_index === finalIndex);
                onSelectSlot(finalIndex, isConfigured);
            }

            // 不管选没选到，都给它合上
            setIsExpanded(false);
            setHoveredIndex(null);
            isDraggingRef.current = false;
        }
    };

    // 渲染单张扑克小图标（用来在已配置手牌槽位上显示）
    const renderCardSummary = (c1: string, c2: string, hitCount: number) => {
        // 简单提取一下例如 'As' -> 'A', 或者直接全部显示
        return (
            <div className="flex flex-col items-center justify-center h-full w-full leading-tight">
                <div className="flex text-xs space-x-1 font-bold">
                    <span>{c1}</span>
                    <span>{c2}</span>
                </div>
                {hitCount > 0 && (
                    <div className="text-[10px] text-yellow-400 mt-0.5 whitespace-nowrap bg-black/40 px-1 rounded-sm">
                        ⭐ {hitCount}
                    </div>
                )}
            </div>
        );
    }

    // 渲染菜单槽位 1 - maxHandsCount
    const slots = Array.from({ length: maxHandsCount }, (_, i) => i + 1);

    return (
        <div
            ref={containerRef}
            className="fixed bottom-24 right-6 z-50 flex flex-col items-center select-none touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            // 防止长按在移动端弹右键菜单
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* 隐藏的子菜单，absolute 叠加在主按钮上，依靠动画上浮 */}
            <div className="absolute bottom-0 w-full flex flex-col items-center pointer-events-none">
                {slots.map((slotIndex, arrIndex) => {
                    const configured = configuredHands.find(h => h.hand_index === slotIndex);
                    const isHovered = hoveredIndex === slotIndex;

                    return (
                        <div
                            key={slotIndex}
                            ref={el => menuItemsRef.current[arrIndex] = el}
                            className={`lucky-hand-item absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all opacity-0 ${isHovered ? 'scale-110 ring-2 ring-yellow-400' : ''
                                } ${configured ? 'bg-indigo-600 text-white border-2 border-indigo-400' : 'bg-slate-700 text-slate-400 border-2 border-dashed border-slate-500'
                                }`}
                        >
                            {configured
                                ? renderCardSummary(configured.card_1, configured.card_2, configured.hit_count)
                                : <span className="text-xl font-bold">+</span>
                            }
                        </div>
                    );
                })}
            </div>

            {/* 主按钮 */}
            <div
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform cursor-pointer
           ${isExpanded ? 'bg-indigo-600 scale-90' : 'bg-gradient-to-tr from-indigo-500 to-purple-500 hover:scale-105 active:scale-95'}`}
            >
                <span className="material-symbols-outlined text-white text-[28px]">
                    {isExpanded ? 'stat_minus_1' : 'playing_cards'}
                </span>
                {/* 提示角标 */}
                {!isExpanded && configuredHands.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold animate-pulse shadow-md">
                        {configuredHands.length}
                    </div>
                )}
            </div>

            {/* 使用提示 (仅有长按行为没配置时提示下) */}
            {!isExpanded && configuredHands.length === 0 && (
                <div className="absolute top-1/2 -left-3 translate-x-[-100%] -translate-y-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-60">
                    长按唤出
                </div>
            )}
        </div>
    );
}
