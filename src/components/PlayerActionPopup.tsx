import React, { useEffect, useRef, useMemo } from 'react';
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

// ─── 布局常量 ───────────────────────────────────────────────────────────────
const BTN_SIZE = 48;          // 按钮直径
const LABEL_H = 16;           // 标签高度
const ITEM_H = BTN_SIZE + 4 + LABEL_H; // 单个 item 总高度（按钮+间距+标签）
const GAP = 10;               // 按钮之间最小间距
const RADIUS = 76;            // 弧形半径
const EDGE_PAD = 6;           // 距屏幕边缘安全距离

/**
 * 长按头像弹出的趣味交互菜单
 * 环形 emoji 气泡，从头像中心弹射扩散
 * 自适应屏幕边缘：根据可用空间选择最优展开方向
 */
export default function PlayerActionPopup({ target, onClose, onStartTimer, onThrowEgg, onCatchChicken, onSendFlower, isSelf }: PlayerActionPopupProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const actions = isSelf
        ? [{ emoji: '⏱️', label: '计时', onClick: onStartTimer }]
        : [
            { emoji: '⏱️', label: '催促', onClick: onStartTimer },
            { emoji: '🥚', label: '砸蛋', onClick: onThrowEgg },
            { emoji: '🐔', label: '抓鸡', onClick: onCatchChicken },
            { emoji: '🌹', label: '鲜花', onClick: onSendFlower },
        ];

    const cx = target.rect.left + target.rect.width / 2;
    const cy = target.rect.top + target.rect.height / 2;

    /**
     * 计算最终按钮位置。
     * 策略：
     *  1. 尝试多个候选弧心角方向（下、上、左、右、左下、右下…）
     *  2. 对每个方向计算各按钮的理想坐标
     *  3. 检查是否所有按钮都在屏幕内 & 互不重叠
     *  4. 选择最优方向；若无完美方案则选溢出最少的方向
     *  5. 最终 clamp 保证不超出屏幕
     */
    const positions = useMemo(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const count = actions.length;
        const half = BTN_SIZE / 2;

        // 可用边界
        const minX = EDGE_PAD + half;
        const maxX = vw - EDGE_PAD - half;
        const minY = EDGE_PAD + half;
        const maxY = vh - EDGE_PAD - half - LABEL_H;

        // 在某个中心角方向上，沿弧形均匀排列按钮
        const layoutArc = (midAngleDeg: number, spreadDeg: number) => {
            if (count === 1) {
                const rad = (midAngleDeg * Math.PI) / 180;
                return [{ x: cx + RADIUS * Math.cos(rad), y: cy - RADIUS * Math.sin(rad) }];
            }
            const totalSpread = spreadDeg;
            const step = totalSpread / (count - 1);
            const startDeg = midAngleDeg - totalSpread / 2;
            return actions.map((_, i) => {
                const deg = startDeg + step * i;
                const rad = (deg * Math.PI) / 180;
                return {
                    x: cx + RADIUS * Math.cos(rad),
                    y: cy - RADIUS * Math.sin(rad),
                };
            });
        };

        // 评估一组位置的质量：溢出像素总和 + 按钮重叠惩罚
        const score = (pts: { x: number; y: number }[]) => {
            let penalty = 0;
            for (const p of pts) {
                if (p.x < minX) penalty += minX - p.x;
                if (p.x > maxX) penalty += p.x - maxX;
                if (p.y < minY) penalty += minY - p.y;
                if (p.y > maxY) penalty += p.y - maxY;
            }
            // 检查按钮之间距离
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const dx = pts[i].x - pts[j].x;
                    const dy = pts[i].y - pts[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = BTN_SIZE + GAP;
                    if (dist < minDist) {
                        penalty += (minDist - dist) * 3; // 重叠惩罚权重高
                    }
                }
            }
            return penalty;
        };

        // 候选方向：midAngle（弧中心角）+ spread（扇形张角）
        // 270=下, 90=上, 0=右, 180=左, 以及对角线
        const candidates: { mid: number; spread: number }[] = [
            { mid: 270, spread: 100 },  // 下方
            { mid: 90, spread: 100 },   // 上方
            { mid: 0, spread: 100 },    // 右方
            { mid: 180, spread: 100 },  // 左方
            { mid: 315, spread: 90 },   // 右下
            { mid: 225, spread: 90 },   // 左下
            { mid: 45, spread: 90 },    // 右上
            { mid: 135, spread: 90 },   // 左上
            { mid: 270, spread: 140 },  // 下方宽
            { mid: 90, spread: 140 },   // 上方宽
        ];

        let bestPts = layoutArc(270, 100);
        let bestScore = score(bestPts);

        for (const c of candidates) {
            const pts = layoutArc(c.mid, c.spread);
            const s = score(pts);
            if (s < bestScore) {
                bestScore = s;
                bestPts = pts;
            }
        }

        // clamp 到安全区域
        return bestPts.map(p => ({
            x: Math.max(minX, Math.min(maxX, p.x)),
            y: Math.max(minY, Math.min(maxY, p.y)),
        }));
    }, [cx, cy, actions.length]);

    useEffect(() => {
        if (!containerRef.current) return;

        const backdrop = containerRef.current.querySelector('.popup-backdrop');
        if (backdrop) {
            anime({ targets: backdrop, opacity: [0, 1], duration: 200, easing: 'easeOutQuad' });
        }

        const btns = containerRef.current.querySelectorAll('.radial-btn');
        btns.forEach((btn, i) => {
            const dx = positions[i].x - cx;
            const dy = positions[i].y - cy;
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
            <div className="popup-backdrop absolute inset-0 bg-black/40 backdrop-blur-[3px]" style={{ opacity: 0 }} />

            {actions.map((action, i) => (
                <div
                    key={i}
                    className="radial-btn absolute z-10 flex flex-col items-center"
                    style={{
                        left: cx - BTN_SIZE / 2,
                        top: cy - BTN_SIZE / 2,
                        width: BTN_SIZE,
                        opacity: 0,
                        transform: 'scale(0)',
                    }}
                    onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                >
                    <div
                        className="rounded-full bg-[#1a2632]/90 ring-1 ring-white/15 shadow-xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer hover:bg-[#243445]"
                        style={{ width: BTN_SIZE, height: BTN_SIZE }}
                    >
                        <span className="text-[24px] leading-none select-none">{action.emoji}</span>
                    </div>
                    <span className="radial-label text-[10px] font-bold text-white/80 mt-1 whitespace-nowrap drop-shadow-md" style={{ opacity: 0 }}>
                        {action.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
