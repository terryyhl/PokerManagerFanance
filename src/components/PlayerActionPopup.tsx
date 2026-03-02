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
    onSendFlower: () => void;
    isSelf: boolean;
}

/**
 * 长按头像弹出的趣味交互菜单
 * 环形 emoji 气泡：围绕头像从中心向外弹射扩散
 */
export default function PlayerActionPopup({ target, onClose, onStartTimer, onThrowEgg, onCatchChicken, onSendFlower, isSelf }: PlayerActionPopupProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const actions = isSelf
        ? [
            { emoji: '\u23F1\uFE0F', label: '计时', onClick: onStartTimer },
        ]
        : [
            { emoji: '\u23F1\uFE0F', label: '催促', onClick: onStartTimer },
            { emoji: '\uD83E\uDD5A', label: '砸蛋', onClick: onThrowEgg },
            { emoji: '\uD83D\uDC14', label: '抓鸡', onClick: onCatchChicken },
            { emoji: '\uD83C\uDF39', label: '鲜花', onClick: onSendFlower },
        ];

    // 计算每个按钮的位置：以头像中心为原点，弧形排列在头像下方
    const centerX = target.rect.left + target.rect.width / 2;
    const centerY = target.rect.top + target.rect.height / 2;

    // 按钮排列参数
    const radius = 70; // 距离头像中心的半径
    const btnSize = 52; // 按钮尺寸

    // 计算弧度：在头像下方 180 度范围内均匀分布
    const getPositions = () => {
        const count = actions.length;
        if (count === 1) {
            // 单个按钮直接在正下方
            return [{ x: centerX, y: centerY + radius }];
        }
        // 多个按钮：从左到右在下半弧均匀分布
        // 起始角度 150°（左下），结束角度 30°（右下），顺时针
        const startAngle = 210; // 度
        const endAngle = 330;   // 度
        const step = (endAngle - startAngle) / (count - 1);
        return actions.map((_, i) => {
            const angleDeg = startAngle + step * i;
            const angleRad = (angleDeg * Math.PI) / 180;
            return {
                x: centerX + radius * Math.cos(angleRad),
                y: centerY - radius * Math.sin(angleRad),
            };
        });
    };

    const positions = getPositions();

    useEffect(() => {
        if (!containerRef.current) return;

        // 遮罩淡入
        const backdrop = containerRef.current.querySelector('.popup-backdrop');
        if (backdrop) {
            anime({ targets: backdrop, opacity: [0, 1], duration: 200, easing: 'easeOutQuad' });
        }

        // 按钮从头像中心弹射出去
        const btns = containerRef.current.querySelectorAll('.radial-btn');
        btns.forEach((btn, i) => {
            const pos = positions[i];
            const dx = pos.x - centerX;
            const dy = pos.y - centerY;
            anime({
                targets: btn,
                translateX: [0, dx],
                translateY: [0, dy],
                scale: [0, 1],
                opacity: [0, 1],
                duration: 350,
                delay: i * 40,
                easing: 'spring(1, 80, 12, 0)',
            });
        });

        // 标签延迟出现
        const labels = containerRef.current.querySelectorAll('.radial-label');
        anime({
            targets: labels,
            opacity: [0, 1],
            translateY: [4, 0],
            duration: 200,
            delay: anime.stagger(40, { start: 250 }),
            easing: 'easeOutQuad',
        });
    }, []);

    const handleClose = () => {
        if (!containerRef.current) { onClose(); return; }

        // 按钮收回
        const btns = containerRef.current.querySelectorAll('.radial-btn');
        anime({
            targets: btns,
            translateX: 0,
            translateY: 0,
            scale: 0,
            opacity: 0,
            duration: 180,
            easing: 'easeInCubic',
        });

        const backdrop = containerRef.current.querySelector('.popup-backdrop');
        anime({
            targets: backdrop,
            opacity: 0,
            duration: 180,
            easing: 'easeInQuad',
            complete: onClose,
        });
    };

    return (
        <div ref={containerRef} className="fixed inset-0 z-[200]" onClick={handleClose}>
            {/* 遮罩 */}
            <div className="popup-backdrop absolute inset-0 bg-black/40 backdrop-blur-[3px]" style={{ opacity: 0 }} />

            {/* 环形按钮：以头像中心为 origin，绝对定位 */}
            {actions.map((action, i) => (
                <div
                    key={i}
                    className="radial-btn absolute z-10 flex flex-col items-center"
                    style={{
                        left: centerX - btnSize / 2,
                        top: centerY - btnSize / 2,
                        width: btnSize,
                        opacity: 0,
                        transform: 'scale(0)',
                    }}
                    onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                >
                    <div className="w-[52px] h-[52px] rounded-full bg-[#1a2632]/90 ring-1 ring-white/15 shadow-xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer hover:bg-[#243445]">
                        <span className="text-[26px] leading-none select-none">{action.emoji}</span>
                    </div>
                    <span className="radial-label text-[10px] font-bold text-white/80 mt-1 whitespace-nowrap drop-shadow-md" style={{ opacity: 0 }}>
                        {action.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
