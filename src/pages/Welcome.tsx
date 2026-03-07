import React, { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import anime from 'animejs';
import AuthLoading from '../components/AuthLoading';
import { useUser } from '../contexts/UserContext';

// 散落的花色符号配置
const SUIT_PARTICLES = [
  { suit: '♠', x: '8%', y: '12%', size: 'text-3xl', rotate: -15, color: 'text-white/[0.04]' },
  { suit: '♥', x: '85%', y: '8%', size: 'text-4xl', rotate: 12, color: 'text-primary/[0.08]' },
  { suit: '♣', x: '75%', y: '25%', size: 'text-2xl', rotate: -30, color: 'text-white/[0.03]' },
  { suit: '♦', x: '15%', y: '35%', size: 'text-5xl', rotate: 20, color: 'text-primary/[0.06]' },
  { suit: '♠', x: '90%', y: '45%', size: 'text-6xl', rotate: -8, color: 'text-white/[0.04]' },
  { suit: '♥', x: '5%', y: '55%', size: 'text-3xl', rotate: 25, color: 'text-primary/[0.06]' },
  { suit: '♣', x: '70%', y: '60%', size: 'text-4xl', rotate: -20, color: 'text-white/[0.03]' },
  { suit: '♦', x: '25%', y: '75%', size: 'text-2xl', rotate: 35, color: 'text-primary/[0.05]' },
  { suit: '♠', x: '55%', y: '15%', size: 'text-3xl', rotate: -40, color: 'text-white/[0.03]' },
  { suit: '♥', x: '40%', y: '85%', size: 'text-5xl', rotate: 10, color: 'text-primary/[0.06]' },
];

// 飞入的扑克牌配置
const FLYING_CARDS = [
  { rank: 'A', suit: '♠', suitColor: '#fff', rotate: -18, offsetX: -55, offsetY: 0, delay: 0 },
  { rank: 'K', suit: '♥', suitColor: '#ef4444', rotate: -6, offsetX: -18, offsetY: -10, delay: 80 },
  { rank: 'Q', suit: '♣', suitColor: '#fff', rotate: 6, offsetX: 18, offsetY: -10, delay: 160 },
  { rank: 'J', suit: '♦', suitColor: '#ef4444', rotate: 18, offsetX: 55, offsetY: 0, delay: 240 },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { user, hydrated } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated || user) return;

    const tl = anime.timeline({ easing: 'easeOutQuint' });

    // 1. 背景花色粒子淡入
    tl.add({
      targets: particlesRef.current?.children,
      opacity: [0, 1],
      duration: 1200,
      delay: anime.stagger(60, { start: 100 }),
    });

    // 2. 扑克牌从底部飞入扇形展开
    tl.add({
      targets: cardsRef.current?.querySelectorAll('.flying-card'),
      translateY: [300, 0],
      translateX: (_el: Element, i: number) => [0, FLYING_CARDS[i].offsetX],
      rotate: (_el: Element, i: number) => [45, FLYING_CARDS[i].rotate],
      opacity: [0, 1],
      scale: [0.5, 1],
      duration: 900,
      delay: anime.stagger(80),
      easing: 'easeOutExpo',
    }, 200);

    // 3. 标题从下方弹入
    tl.add({
      targets: titleRef.current,
      translateY: [60, 0],
      opacity: [0, 1],
      duration: 800,
      easing: 'easeOutExpo',
    }, '-=400');

    // 4. 副标题淡入
    tl.add({
      targets: subtitleRef.current,
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 700,
    }, '-=500');

    // 5. 按钮从底部弹入
    tl.add({
      targets: btnRef.current,
      translateY: [40, 0],
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 600,
      easing: 'easeOutExpo',
    }, '-=400');

    return () => {
      tl.pause();
      if (particlesRef.current) anime.remove(particlesRef.current.children);
      if (cardsRef.current) anime.remove(cardsRef.current.querySelectorAll('.flying-card'));
      anime.remove([titleRef.current, subtitleRef.current, btnRef.current].filter(Boolean));
    };
  }, [hydrated, user]);

  if (!hydrated) return <AuthLoading />;
  if (user) return <Navigate to="/lobby" replace />;

  return (
    <div ref={containerRef} className="relative flex h-dvh w-full flex-col items-center overflow-hidden bg-[#0a1118]">
      {/* 径向光晕背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 35%, rgba(19,127,236,0.08) 0%, transparent 70%)',
        }}
      />

      {/* 散落花色粒子 */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none select-none">
        {SUIT_PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`absolute ${p.size} ${p.color} font-black opacity-0`}
            style={{
              left: p.x,
              top: p.y,
              transform: `rotate(${p.rotate}deg)`,
            }}
          >
            {p.suit}
          </span>
        ))}
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full max-w-md mx-auto px-6">

        {/* 扑克牌扇形 */}
        <div ref={cardsRef} className="relative h-[180px] w-[280px] mb-10">
          {FLYING_CARDS.map((card, i) => (
            <div
              key={i}
              className="flying-card absolute left-1/2 bottom-0 -ml-[42px] opacity-0"
              style={{
                transform: `translateX(${card.offsetX}px) translateY(${card.offsetY}px) rotate(${card.rotate}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <div
                className="w-[84px] h-[120px] rounded-xl bg-[#f5f0e8] shadow-2xl shadow-black/40 flex flex-col justify-between p-2.5 select-none"
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                {/* 左上角 */}
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xl font-black" style={{ color: card.suitColor === '#fff' ? '#1a1a2e' : card.suitColor }}>{card.rank}</span>
                  <span className="text-sm -mt-0.5" style={{ color: card.suitColor === '#fff' ? '#1a1a2e' : card.suitColor }}>{card.suit}</span>
                </div>
                {/* 中央大花色 */}
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-4xl" style={{ color: card.suitColor === '#fff' ? '#1a1a2e' : card.suitColor }}>{card.suit}</span>
                </div>
                {/* 右下角（倒转） */}
                <div className="flex flex-col items-end leading-none rotate-180">
                  <span className="text-xl font-black" style={{ color: card.suitColor === '#fff' ? '#1a1a2e' : card.suitColor }}>{card.rank}</span>
                  <span className="text-sm -mt-0.5" style={{ color: card.suitColor === '#fff' ? '#1a1a2e' : card.suitColor }}>{card.suit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 标题 */}
        <h1
          ref={titleRef}
          className="text-center leading-[0.95] tracking-tight mb-5 opacity-0"
        >
          <span className="block text-7xl font-black text-white">
            扑克
          </span>
          <span className="block text-5xl font-black mt-1">
            <span className="text-primary">俱乐部</span>
            <span className="text-white/60 text-3xl font-bold ml-2">管理</span>
          </span>
        </h1>

        {/* 副标题 */}
        <p
          ref={subtitleRef}
          className="text-slate-400 text-base font-medium tracking-wide text-center max-w-[260px] leading-relaxed mb-12 opacity-0"
        >
          自动追踪买入，即时结算私人对局
        </p>

        {/* CTA 按钮 */}
        <button
          ref={btnRef}
          onClick={() => navigate('/login')}
          className="group w-full max-w-[280px] h-14 rounded-2xl bg-primary text-white font-black text-lg tracking-wide shadow-[0_6px_24px_rgba(19,127,236,0.35)] transition-all active:scale-[0.97] hover:bg-blue-500 flex items-center justify-center gap-2 opacity-0"
        >
          进入俱乐部
          <span className="text-xl transition-transform group-hover:translate-x-1">♠</span>
        </button>
      </div>

      {/* 底部装饰线 */}
      <div className="w-full pb-10 flex justify-center">
        <div className="flex items-center gap-3 text-white/10 text-sm select-none">
          <span>♣</span>
          <div className="w-16 h-px bg-white/10" />
          <span>♦</span>
          <div className="w-16 h-px bg-white/10" />
          <span>♥</span>
        </div>
      </div>
    </div>
  );
}
