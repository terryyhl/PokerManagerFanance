import React, { useRef, useEffect, useCallback, useId } from 'react';

/**
 * 3D 沙漏组件 — 纯 SVG + requestAnimationFrame 粒子系统
 * 从 hourglass-test.html v4 原型提取
 */

interface HourglassProps {
  /** 0~1，1=满（刚开始），0=空（结束） */
  progress: number;
  /** 是否正在运行（控制粒子流动） */
  isRunning: boolean;
  /** SVG 宽度 px，高度按 4:5 比例计算（默认 180） */
  size?: number;
}

// ===================== 常量 =====================
const CX = 90;              // 沙漏中线 x
const UPPER_TOP = 38;       // 上半沙区顶 y
const UPPER_BOTTOM = 120;   // 上半沙区底 y（颈部上沿）
const NECK_Y = 122;         // 颈部中心 y（粒子起点）
const LOWER_TOP = 132;      // 下半沙区顶 y（颈部下沿）
const LOWER_BOTTOM = 202;   // 下半沙区底 y
const MAX_HALF_W = 60;      // 下半玻璃壁最大半宽
const REPOSE_RATIO = 0.7;   // 安息角系数
const CRITICAL_H = MAX_HALF_W * REPOSE_RATIO; // ~42
const TOTAL_H = LOWER_BOTTOM - LOWER_TOP;     // 70
const CRITICAL_FILL = (CRITICAL_H / TOTAL_H) * 0.55; // ~0.33

const PARTICLE_POOL_SIZE = 24;
const SAND_COLORS = ['#f5d280', '#e8b84b', '#daa520', '#ecc65a', '#d4a017', '#f0c850'];

// ===================== 沙量计算 =====================
function getSandBottomTopY(fillRatio: number): number {
  if (fillRatio < 0.01) return LOWER_BOTTOM;
  if (fillRatio <= CRITICAL_FILL) {
    const t = fillRatio / CRITICAL_FILL;
    return LOWER_BOTTOM - CRITICAL_H * t;
  }
  const t = (fillRatio - CRITICAL_FILL) / (1 - CRITICAL_FILL);
  const baseY = LOWER_BOTTOM - CRITICAL_H;
  return baseY - (baseY - LOWER_TOP) * t;
}

// ===================== 粒子类型 =====================
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

export default function Hourglass({ progress, isRunning, size = 180 }: HourglassProps) {
  // 生成唯一 id 前缀，避免多实例 SVG gradient/clipPath 冲突
  const rawId = useId();
  const uid = rawId.replace(/:/g, ''); // 去掉冒号以合法化 SVG id
  const id = (name: string) => `hg${uid}-${name}`;
  const idUrl = (name: string) => `url(#hg${uid}-${name})`;

  const particleGroupRef = useRef<SVGGElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particleElsRef = useRef<SVGCircleElement[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const progressRef = useRef(progress);
  const isRunningRef = useRef(isRunning);

  // 保持 ref 同步
  progressRef.current = progress;
  isRunningRef.current = isRunning;

  // ---- 初始化粒子池 ----
  useEffect(() => {
    const g = particleGroupRef.current;
    if (!g) return;

    // 清空
    while (g.firstChild) g.removeChild(g.firstChild);

    const particles: Particle[] = [];
    const els: SVGCircleElement[] = [];

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '1.2');
      c.setAttribute('fill', SAND_COLORS[i % SAND_COLORS.length]);
      c.setAttribute('opacity', '0');
      g.appendChild(c);
      els.push(c);
      particles.push({
        x: CX, y: NECK_Y, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1.2, active: false,
      });
    }

    particlesRef.current = particles;
    particleElsRef.current = els;

    return () => {
      while (g.firstChild) g.removeChild(g.firstChild);
    };
  }, []);

  // ---- 粒子生成 ----
  const spawnParticle = useCallback((p: Particle, pileTopY: number) => {
    p.active = true;
    p.x = CX + (Math.random() - 0.5) * 6;
    p.y = NECK_Y;
    p.vx = (Math.random() - 0.5) * 0.8;
    p.vy = 0.5 + Math.random() * 0.5;
    const fallDist = Math.max(10, pileTopY - NECK_Y);
    p.maxLife = fallDist / 1.8 + Math.random() * 8;
    p.life = 0;
    p.size = 0.8 + Math.random() * 1.2;
  }, []);

  // ---- 动画循环 ----
  useEffect(() => {
    const loop = (timestamp: number) => {
      const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 16.67 : 1;
      lastTimeRef.current = timestamp;

      const prog = progressRef.current;
      const running = isRunningRef.current;
      const fillRatio = 1 - prog;
      const pileTopY = getSandBottomTopY(fillRatio);
      const particles = particlesRef.current;
      const els = particleElsRef.current;
      const flowing = running && prog < 0.995 && prog > 0.005;

      // 生成新粒子
      if (flowing) {
        const spawnRate = Math.max(1, Math.floor(prog * 4));
        let spawned = 0;
        for (let i = 0; i < particles.length; i++) {
          if (!particles[i].active && spawned < spawnRate && Math.random() < 0.15) {
            spawnParticle(particles[i], pileTopY);
            els[i].setAttribute('r', String(particles[i].size));
            spawned++;
          }
        }
      }

      // 更新粒子
      const gravity = 0.12;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const el = els[i];
        if (!p.active) {
          // 不运行时让残留粒子快速消亡
          if (!running) {
            el.setAttribute('opacity', '0');
          } else {
            el.setAttribute('opacity', '0');
          }
          continue;
        }

        p.life += running ? dt : dt * 3;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;

        if (p.y >= pileTopY - 2 || p.life >= p.maxLife) {
          p.active = false;
          el.setAttribute('opacity', '0');
          continue;
        }

        const fallProgress = (p.y - NECK_Y) / Math.max(1, pileTopY - NECK_Y);
        const maxDrift = 3 + fallProgress * 12;
        p.x = Math.max(CX - maxDrift, Math.min(CX + maxDrift, p.x));

        let opacity: number;
        if (fallProgress < 0.1) opacity = fallProgress / 0.1;
        else if (fallProgress > 0.8) opacity = (1 - fallProgress) / 0.2;
        else opacity = 1;
        opacity = Math.max(0, Math.min(1, opacity)) * 0.9;

        el.setAttribute('cx', String(p.x));
        el.setAttribute('cy', String(p.y));
        el.setAttribute('opacity', opacity.toFixed(2));
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [spawnParticle]);

  // ===================== 沙子形状计算 =====================
  const fillRatio = 1 - progress;

  // 上半沙子
  const upperRange = UPPER_BOTTOM - UPPER_TOP;
  const sandSurfaceY = UPPER_TOP + upperRange * (1 - progress);
  const sandHeight = Math.max(0, UPPER_BOTTOM - sandSurfaceY);

  // 漏斗凹陷
  const showFunnel = progress > 0.03 && progress < 0.98;
  const funnelDip = 3 + (1 - progress) * 5;

  // 下半沙子路径
  let sandBottomD = '';
  let sandBottomOpacity = 0;
  if (fillRatio < 0.01) {
    sandBottomD = `M${CX},${LOWER_BOTTOM} L${CX},${LOWER_BOTTOM} Z`;
    sandBottomOpacity = 0;
  } else if (fillRatio <= CRITICAL_FILL) {
    const t = fillRatio / CRITICAL_FILL;
    const coneH = CRITICAL_H * t;
    const coneHalfW = coneH / REPOSE_RATIO;
    const tipY = LOWER_BOTTOM - coneH;
    const cpY = Math.min(coneH * 0.25, 8);
    sandBottomD = `M${CX - coneHalfW},${LOWER_BOTTOM} Q${CX},${tipY - cpY} ${CX + coneHalfW},${LOWER_BOTTOM} Z`;
    sandBottomOpacity = 0.9;
  } else {
    const t = (fillRatio - CRITICAL_FILL) / (1 - CRITICAL_FILL);
    const baseY = LOWER_BOTTOM - CRITICAL_H;
    const surfaceY = baseY - (baseY - LOWER_TOP) * t;
    const archH = Math.max(2, 8 * (1 - t));
    sandBottomD = `M${CX - MAX_HALF_W},${LOWER_BOTTOM} L${CX - MAX_HALF_W},${surfaceY + archH} Q${CX},${surfaceY - archH} ${CX + MAX_HALF_W},${surfaceY + archH} L${CX + MAX_HALF_W},${LOWER_BOTTOM} Z`;
    sandBottomOpacity = 0.9;
  }

  // viewBox 固定 180x240，通过外层 div 的 width/height 缩放
  const height = size * (240 / 180);

  return (
    <div style={{ width: size, height, flexShrink: 0 }} className="relative">
      <svg
        viewBox="0 0 180 240"
        width={size}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
      >
        <defs>
          <linearGradient id={id('glassGrad')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3e8" stopOpacity={0.7} />
            <stop offset="30%" stopColor="#b5ecf7" stopOpacity={0.5} />
            <stop offset="50%" stopColor="#d4f4fb" stopOpacity={0.35} />
            <stop offset="70%" stopColor="#b5ecf7" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7dd3e8" stopOpacity={0.7} />
          </linearGradient>

          <linearGradient id={id('glassEdge')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4aafbf" stopOpacity={0.8} />
            <stop offset="15%" stopColor="#7dd3e8" stopOpacity={0.4} />
            <stop offset="85%" stopColor="#7dd3e8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#4aafbf" stopOpacity={0.8} />
          </linearGradient>

          <linearGradient id={id('sandGrad')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5d280" />
            <stop offset="50%" stopColor="#daa520" />
            <stop offset="100%" stopColor="#c4931a" />
          </linearGradient>

          <linearGradient id={id('sandBottomGrad')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8b84b" />
            <stop offset="40%" stopColor="#daa520" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>

          <linearGradient id={id('frameGrad')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d45a3a" />
            <stop offset="30%" stopColor="#c0422a" />
            <stop offset="70%" stopColor="#a83620" />
            <stop offset="100%" stopColor="#8b2c1a" />
          </linearGradient>

          <linearGradient id={id('frameGradDark')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8432a" />
            <stop offset="50%" stopColor="#963822" />
            <stop offset="100%" stopColor="#7a2d18" />
          </linearGradient>

          {/* 上半沙子裁剪 */}
          <clipPath id={id('clipUpper')}>
            <path d="M30,38 Q30,90 60,108 L90,120 L120,108 Q150,90 150,38 Z" />
          </clipPath>

          {/* 下半沙子裁剪 */}
          <clipPath id={id('clipLower')}>
            <path d="M60,132 L90,120 L120,132 Q150,150 150,206 L30,206 Q30,150 60,132 Z" />
          </clipPath>

          {/* 粒子裁剪：颈部 + 下半玻璃内部 */}
          <clipPath id={id('clipNeck')}>
            <path d="M80,112 L100,112 L120,132 Q150,150 150,206 L30,206 Q30,150 60,132 Z" />
          </clipPath>
        </defs>

        {/* ========== 上木框 ========== */}
        <rect x="18" y="20" width="144" height="14" rx="3" fill={idUrl('frameGradDark')} />
        <rect x="14" y="8" width="152" height="16" rx="4" fill={idUrl('frameGrad')} />
        <g stroke="#8b2c1a" strokeWidth="0.5" opacity={0.4}>
          <line x1="35" y1="8" x2="35" y2="24" />
          <line x1="55" y1="8" x2="55" y2="34" />
          <line x1="125" y1="8" x2="125" y2="34" />
          <line x1="145" y1="8" x2="145" y2="24" />
        </g>
        <rect x="16" y="9" width="148" height="3" rx="1.5" fill="white" opacity={0.15} />

        {/* ========== 下木框 ========== */}
        <rect x="14" y="218" width="152" height="16" rx="4" fill={idUrl('frameGrad')} />
        <rect x="18" y="206" width="144" height="14" rx="3" fill={idUrl('frameGradDark')} />
        <g stroke="#8b2c1a" strokeWidth="0.5" opacity={0.4}>
          <line x1="35" y1="218" x2="35" y2="234" />
          <line x1="55" y1="206" x2="55" y2="234" />
          <line x1="125" y1="206" x2="125" y2="234" />
          <line x1="145" y1="218" x2="145" y2="234" />
        </g>
        <rect x="16" y="230" width="148" height="2" rx="1" fill="white" opacity={0.1} />

        {/* ========== 玻璃外壳 ========== */}
        <path
          d="M30,34 Q28,90 62,112 L82,122 Q90,126 98,122 L118,112 Q152,90 150,34 Z"
          fill={idUrl('glassGrad')} stroke={idUrl('glassEdge')} strokeWidth="2"
        />
        <path
          d="M82,122 Q90,126 98,122 L118,132 Q152,152 150,206 L30,206 Q28,152 62,132 Z"
          fill={idUrl('glassGrad')} stroke={idUrl('glassEdge')} strokeWidth="2"
        />

        {/* ========== 上半沙子 ========== */}
        <g clipPath={idUrl('clipUpper')}>
          <rect
            x="28" y={sandSurfaceY} width="124" height={sandHeight}
            fill={idUrl('sandGrad')} opacity={0.9}
            className="transition-all duration-1000 ease-in-out"
          />
          {showFunnel && (
            <ellipse
              cx={CX} cy={sandSurfaceY + 1} rx={48} ry={funnelDip}
              fill="#0f172a" opacity={0.5}
              className="transition-all duration-1000 ease-in-out"
            />
          )}
        </g>

        {/* ========== 下半沙子 ========== */}
        <g clipPath={idUrl('clipLower')}>
          <path
            d={sandBottomD}
            fill={idUrl('sandBottomGrad')} opacity={sandBottomOpacity}
            className="transition-all duration-1000 ease-in-out"
          />
        </g>

        {/* ========== 粒子（JS 驱动） ========== */}
        <g ref={particleGroupRef} clipPath={idUrl('clipNeck')} />

        {/* ========== 玻璃高光 ========== */}
        {/* 左侧 — 上半 */}
        <path d="M42,42 Q38,70 56,100" stroke="white" strokeWidth="3.5"
          fill="none" opacity={0.25} strokeLinecap="round" />
        <path d="M46,44 Q44,60 52,80" stroke="white" strokeWidth="1.5"
          fill="none" opacity={0.35} strokeLinecap="round" />
        {/* 左侧 — 下半 */}
        <path d="M56,142 Q38,170 42,198" stroke="white" strokeWidth="3.5"
          fill="none" opacity={0.2} strokeLinecap="round" />
        <path d="M52,155 Q44,175 46,195" stroke="white" strokeWidth="1.5"
          fill="none" opacity={0.3} strokeLinecap="round" />
        {/* 右侧微光 */}
        <path d="M136,50 Q142,75 130,100" stroke="white" strokeWidth="2"
          fill="none" opacity={0.1} strokeLinecap="round" />
        <path d="M130,145 Q142,170 136,195" stroke="white" strokeWidth="2"
          fill="none" opacity={0.08} strokeLinecap="round" />
      </svg>
    </div>
  );
}
