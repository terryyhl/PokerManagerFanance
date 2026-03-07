import React, { useEffect, useState } from 'react';
import Avatar from './Avatar';

export interface PlayerActionTarget {
    userId: string;
    username: string;
    rect: DOMRect; // 保留接口兼容（底部面板不使用）
}

interface PlayerActionPopupProps {
    target: PlayerActionTarget;
    onClose: () => void;
    onStartTimer: () => void;
    onThrowEgg: () => void;
    onCatchChicken: () => void;
    onSendFlower: () => void;
    isSelf: boolean;
}

/**
 * 长按头像弹出的底部操作面板
 * 从底部滑入，固定位置，操作区域大，符合移动端习惯
 */
export default function PlayerActionPopup({ target, onClose, onStartTimer, onThrowEgg, onCatchChicken, onSendFlower, isSelf }: PlayerActionPopupProps) {
    const [visible, setVisible] = useState(false);

    const actions = isSelf
        ? [{ emoji: '⏱️', label: '计时', onClick: onStartTimer }]
        : [
            { emoji: '⏱️', label: '催促', onClick: onStartTimer },
            { emoji: '🥚', label: '砸蛋', onClick: onThrowEgg },
            { emoji: '🐔', label: '抓鸡', onClick: onCatchChicken },
            { emoji: '🌹', label: '鲜花', onClick: onSendFlower },
        ];

    // 挂载后下一帧触发入场动画
    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 200); // 等退场动画结束
    };

    const handleAction = (action: () => void) => {
        action();
        // action 内部会 setActionPopupTarget(null) 关闭组件，无需手动 close
    };

    return (
        <div className="fixed inset-0 z-[200]" onClick={handleClose}>
            {/* 遮罩 */}
            <div
                className="absolute inset-0 bg-black/50 transition-opacity duration-200"
                style={{ opacity: visible ? 1 : 0 }}
            />

            {/* 底部面板 */}
            <div
                className="absolute bottom-0 left-0 right-0 bg-surface-dark rounded-t-2xl border-t border-white/10 transition-transform duration-300 ease-out"
                style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 拖动指示条 */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                {/* 目标玩家信息 */}
                <div className="flex items-center gap-3 px-5 pb-4">
                    <Avatar username={target.username} className="w-10 h-10" />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{target.username}</span>
                        <span className="text-[11px] text-slate-500">选择一个操作</span>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 px-5 pb-3">
                    {actions.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => handleAction(action.onClick)}
                            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/10 active:scale-95 active:bg-white/15 transition-all cursor-pointer"
                        >
                            <span className="text-[28px] leading-none select-none">{action.emoji}</span>
                            <span className="text-[11px] text-white/70 font-medium">{action.label}</span>
                        </button>
                    ))}
                </div>

                {/* 底部安全区 */}
                <div style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }} />
            </div>
        </div>
    );
}
