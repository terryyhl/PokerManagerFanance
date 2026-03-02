import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

export interface PlayerActionTarget {
    userId: string;
    username: string;
    rect: DOMRect; // 头像在屏幕上的位置
}

interface PlayerActionPopupProps {
    target: PlayerActionTarget;
    onClose: () => void;
    onStartTimer: () => void;
    onThrowEgg: () => void;
    onCatchChicken: () => void;
    isSelf: boolean;
}

/**
 * 长按头像弹出的趣味交互菜单
 * 以对话气泡形式显示在目标头像附近
 */
export default function PlayerActionPopup({ target, onClose, onStartTimer, onThrowEgg, onCatchChicken, isSelf }: PlayerActionPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (popupRef.current) {
            // 气泡整体弹入 — 极快
            anime({
                targets: popupRef.current,
                scale: [0.7, 1],
                opacity: [0, 1],
                duration: 150,
                easing: 'easeOutCubic',
            });
            // 按钮项同时出现，不再逐个 stagger
            anime({
                targets: popupRef.current.querySelectorAll('.action-btn'),
                scale: [0.5, 1],
                opacity: [0, 1],
                duration: 150,
                delay: 50,
                easing: 'easeOutCubic',
            });
        }
    }, []);

    // 气泡位置：尽量在头像下方居中
    const bubbleTop = target.rect.bottom + 8;
    const bubbleLeft = Math.max(16, Math.min(target.rect.left + target.rect.width / 2 - 100, window.innerWidth - 216));

    const actions = isSelf
        ? [
            { icon: 'timer', label: '自我计时', color: 'text-orange-500', bg: 'bg-orange-500/10', onClick: onStartTimer },
        ]
        : [
            { icon: 'timer', label: '催促计时', color: 'text-orange-500', bg: 'bg-orange-500/10', onClick: onStartTimer },
            { icon: 'egg_alt', label: '扔鸡蛋', color: 'text-red-500', bg: 'bg-red-500/10', onClick: onThrowEgg },
            { icon: 'pets', label: '抓鸡', color: 'text-yellow-600', bg: 'bg-yellow-500/10', onClick: onCatchChicken },
        ];

    return (
        <div className="fixed inset-0 z-[200]" onClick={onClose}>
            {/* 半透明遮罩 */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

            {/* 气泡弹窗 */}
            <div
                ref={popupRef}
                className="absolute z-10"
                style={{ top: bubbleTop, left: bubbleLeft, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                {/* 小三角指示箭头 */}
                <div
                    className="absolute -top-2 w-4 h-4 bg-white dark:bg-[#1e2936] rotate-45 border-l border-t border-slate-200 dark:border-slate-700"
                    style={{ left: Math.max(20, target.rect.left + target.rect.width / 2 - bubbleLeft - 8) }}
                />

                <div className="relative bg-white dark:bg-[#1e2936] rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden min-w-[180px]">
                    <div className="p-2 flex flex-col gap-1">
                        {actions.map((action) => (
                            <button
                                key={action.icon}
                                onClick={action.onClick}
                                className={`action-btn flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 transition-all`}
                                style={{ opacity: 0, transform: 'scale(0)' }}
                            >
                                <div className={`w-8 h-8 rounded-full ${action.bg} flex items-center justify-center`}>
                                    <span className={`material-symbols-outlined text-[18px] ${action.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {action.icon}
                                    </span>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
