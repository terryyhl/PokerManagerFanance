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
 * 自动适配屏幕边缘：检测头像位置，动态调整弧形展开方向
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

    const centerX = target.rect.left + target.rect.width / 2;
    const centerY = target.rect.top + target.rect.height / 2;

    const radius = 70;
    const btnSize = 52;
    const labelHeight = 18; // 按钮下方标签的额外高度
    const safeMargin = 8;   // 距离屏幕边缘的最小安全间距

    /**
     * 根据头像中心在视口中的位置，计算弧形展开的角度范围。
     * 角度采用标准数学角（0°=右，90°=上，180°=左，270°=下）。
     * 默认向下展开 (210°~330°)，但如果空间不够则调整。
     */
    const getPositions = () => {
        const count = actions.length;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // 按钮占据的半径范围（含按钮自身尺寸）
        const effectiveR = radius + btnSize / 2 + labelHeight;

        // 计算四个方向的可用空间
        const spaceTop = centerY - safeMargin;
        const spaceBottom = vh - centerY - safeMargin;
        const spaceLeft = centerX - safeMargin;
        const spaceRight = vw - centerX - safeMargin;

        let startAngle: number;
        let endAngle: number;

        if (count === 1) {
            // 单个按钮：选空间最大的方向
            if (spaceBottom >= effectiveR) {
                return [{ x: centerX, y: centerY + radius }];
            } else if (spaceTop >= effectiveR) {
                return [{ x: centerX, y: centerY - radius }];
            } else if (spaceRight >= effectiveR) {
                return [{ x: centerX + radius, y: centerY }];
            } else {
                return [{ x: centerX - radius, y: centerY }];
            }
        }

        // 判定主展开方向（哪边空间大就往哪边展开）
        const canGoDown = spaceBottom >= effectiveR;
        const canGoUp = spaceTop >= effectiveR;
        const canGoLeft = spaceLeft >= effectiveR;
        const canGoRight = spaceRight >= effectiveR;

        if (canGoDown) {
            // 默认向下展开
            startAngle = 210;
            endAngle = 330;
        } else if (canGoUp) {
            // 向上展开
            startAngle = 30;
            endAngle = 150;
        } else if (canGoRight) {
            // 向右展开
            startAngle = 300;
            endAngle = 60; // 跨越 0°
        } else if (canGoLeft) {
            // 向左展开
            startAngle = 120;
            endAngle = 240;
        } else {
            // 四面都挤：默认向下
            startAngle = 210;
            endAngle = 330;
        }

        // 如果是向下展开，再做左/右边缘微调
        if (canGoDown) {
            // 左边空间不够 → 把弧往右偏
            if (spaceLeft < effectiveR) {
                const shift = Math.min(40, (effectiveR - spaceLeft) * 0.8);
                startAngle -= shift;
                endAngle -= shift;
            }
            // 右边空间不够 → 把弧往左偏
            if (spaceRight < effectiveR) {
                const shift = Math.min(40, (effectiveR - spaceRight) * 0.8);
                startAngle += shift;
                endAngle += shift;
            }
        }
        // 向上展开时也微调左右
        if (!canGoDown && canGoUp) {
            if (spaceLeft < effectiveR) {
                const shift = Math.min(40, (effectiveR - spaceLeft) * 0.8);
                startAngle -= shift;
                endAngle -= shift;
            }
            if (spaceRight < effectiveR) {
                const shift = Math.min(40, (effectiveR - spaceRight) * 0.8);
                startAngle += shift;
                endAngle += shift;
            }
        }

        // 计算展开范围（处理跨 360° 的情况）
        let sweep = endAngle - startAngle;
        if (sweep < 0) sweep += 360;
        const step = count > 1 ? sweep / (count - 1) : 0;

        const raw = actions.map((_, i) => {
            const angleDeg = startAngle + step * i;
            const angleRad = (angleDeg * Math.PI) / 180;
            return {
                x: centerX + radius * Math.cos(angleRad),
                y: centerY - radius * Math.sin(angleRad),
            };
        });

        // 最终安全 clamp：确保按钮不超出屏幕
        const halfBtn = btnSize / 2;
        return raw.map(pos => ({
            x: Math.max(halfBtn + safeMargin, Math.min(vw - halfBtn - safeMargin, pos.x)),
            y: Math.max(halfBtn + safeMargin, Math.min(vh - halfBtn - labelHeight - safeMargin, pos.y)),
        }));
    };

    const positions = getPositions();

    useEffect(() => {
        if (!containerRef.current) return;

        const backdrop = containerRef.current.querySelector('.popup-backdrop');
        if (backdrop) {
            anime({ targets: backdrop, opacity: [0, 1], duration: 200, easing: 'easeOutQuad' });
        }

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
