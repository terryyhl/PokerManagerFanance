import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';
import AuthLoading from '../components/AuthLoading';
import { usersApi } from '../lib/api';
import { useUser } from '../contexts/UserContext';

// 背景花色装饰（少量、克制、与 Welcome 呼应）
const SUIT_DECOR = [
  { suit: '♠', x: '10%', y: '8%', size: 'text-4xl', rotate: -20, color: 'text-white/[0.03]' },
  { suit: '♥', x: '88%', y: '15%', size: 'text-3xl', rotate: 15, color: 'text-primary/[0.07]' },
  { suit: '♣', x: '80%', y: '55%', size: 'text-5xl', rotate: -10, color: 'text-white/[0.03]' },
  { suit: '♦', x: '6%', y: '70%', size: 'text-3xl', rotate: 25, color: 'text-primary/[0.05]' },
  { suit: '♥', x: '50%', y: '90%', size: 'text-4xl', rotate: -35, color: 'text-primary/[0.05]' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hydrated, setUser } = useUser();
  const fromLocation = (location.state as {
    from?: { pathname: string; search?: string; hash?: string };
  } | null)?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/lobby';

  const containerRef = useRef<HTMLDivElement>(null);
  const decorRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hydrated || user) return;

    const tl = anime.timeline({ easing: 'easeOutQuint' });

    // 1. 背景花色淡入
    tl.add({
      targets: decorRef.current?.children,
      opacity: [0, 1],
      duration: 1000,
      delay: anime.stagger(80, { start: 100 }),
    });

    // 2. 头部区域（花色 + 标题 + 副标题）
    tl.add({
      targets: headerRef.current?.querySelectorAll('.anim-item'),
      translateY: [40, 0],
      opacity: [0, 1],
      duration: 700,
      easing: 'easeOutExpo',
      delay: anime.stagger(100),
    }, 200);

    // 3. 表单元素
    tl.add({
      targets: formRef.current?.querySelectorAll('.anim-item'),
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: anime.stagger(100),
    }, '-=300');

    return () => {
      tl.pause();
      if (decorRef.current) anime.remove(decorRef.current.children);
      if (headerRef.current) anime.remove(headerRef.current.querySelectorAll('.anim-item'));
      if (formRef.current) anime.remove(formRef.current.querySelectorAll('.anim-item'));
    };
  }, [hydrated, user]);

  if (!hydrated) return <AuthLoading />;
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const { user } = await usersApi.login(username.trim());
      setUser(user);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-h-dvh w-full flex flex-col bg-[#0a1118] overflow-hidden">
      {/* 径向光晕 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 50% 25%, rgba(19,127,236,0.06) 0%, transparent 70%)',
        }}
      />

      {/* 背景花色 */}
      <div ref={decorRef} className="absolute inset-0 pointer-events-none select-none">
        {SUIT_DECOR.map((p, i) => (
          <span
            key={i}
            className={`absolute ${p.size} ${p.color} font-black opacity-0`}
            style={{ left: p.x, top: p.y, transform: `rotate(${p.rotate}deg)` }}
          >
            {p.suit}
          </span>
        ))}
      </div>

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center p-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-white/70 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 flex-1 flex flex-col px-6 w-full max-w-[400px] mx-auto">
        {/* 头部 */}
        <div ref={headerRef} className="pt-4 pb-10">
          {/* 扑克花色装饰图标 */}
          <div className="anim-item flex items-center gap-2 mb-6 opacity-0">
            <span className="text-3xl text-primary">♥</span>
            <span className="text-3xl text-white/80">♠</span>
          </div>

          {/* 标题 — 极大字号，层级鲜明 */}
          <h1 className="anim-item leading-[0.95] tracking-tight mb-4 opacity-0">
            <span className="block text-6xl font-black text-white">欢迎</span>
            <span className="block text-4xl font-black text-white/50 mt-1">回来</span>
          </h1>

          {/* 副标题 */}
          <p className="anim-item text-slate-500 text-base leading-relaxed max-w-[280px] opacity-0">
            输入昵称，回到牌桌
          </p>
        </div>

        {/* 登录表单 */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
          {/* 昵称输入 */}
          <div className="anim-item flex flex-col gap-2.5 opacity-0">
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">昵称</span>
            <div className="relative">
              <input
                className="w-full h-16 rounded-2xl bg-white/[0.06] border-2 border-white/[0.08] text-white text-xl font-bold px-5 placeholder:text-white/20 focus:outline-none focus:border-primary/60 focus:bg-white/[0.08] transition-all"
                placeholder="PokerKing"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <span className="text-white/15 text-lg">♠</span>
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <div className="anim-item pt-2 opacity-0">
            <button
              type="submit"
              disabled={isLoading}
              className="group w-full h-14 rounded-2xl bg-primary text-white font-black text-lg tracking-wide shadow-[0_6px_24px_rgba(19,127,236,0.3)] active:scale-[0.97] transition-all hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <>
                  <span>进入大厅</span>
                  <span className="text-lg transition-transform group-hover:translate-x-1">♠</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* 底部装饰 */}
      <div className="relative z-10 w-full pb-10 flex justify-center">
        <div className="flex items-center gap-3 text-white/10 text-sm select-none">
          <span>♣</span>
          <div className="w-12 h-px bg-white/10" />
          <span>♦</span>
          <div className="w-12 h-px bg-white/10" />
          <span>♥</span>
        </div>
      </div>
    </div>
  );
}
