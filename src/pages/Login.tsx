import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { usersApi } from '../lib/api';
import { useUser } from '../contexts/UserContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useUser();
  // ProtectedRoute 重定向时会传 state.from，登录后跳回原页面
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/lobby';
  const formRef = useRef<HTMLFormElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    anime({
      targets: headerRef.current?.children,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: anime.stagger(100)
    });

    anime({
      targets: formRef.current?.children,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: anime.stagger(100, { start: 300 })
    });
  }, []);

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
    <AnimatedPage animationType="slide-left">
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-full h-full flex flex-col">
        <header className="flex items-center justify-between p-4 sticky top-0 z-10 bg-background-light dark:bg-background-dark">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">登录</h2>
        </header>

        <main className="flex-1 flex flex-col px-4 pt-4 pb-8 w-full max-w-[480px] mx-auto">
          <div ref={headerRef} className="flex flex-col items-center justify-center pb-8 pt-4">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center mb-6 shadow-lg shadow-primary/20 opacity-0">
              <span className="material-symbols-outlined text-white text-[32px]">playing_cards</span>
            </div>
            <h1 className="text-slate-900 dark:text-white tracking-tight text-[32px] font-bold leading-tight text-center opacity-0">欢迎回来</h1>
            <p className="text-slate-500 dark:text-[#92adc9] text-base font-normal leading-normal pt-2 text-center max-w-[300px] opacity-0">请输入您的昵称以进入俱乐部。</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            <label className="flex flex-col gap-2 opacity-0">
              <span className="text-slate-900 dark:text-white text-sm font-medium leading-normal">昵称或用户名</span>
              <div className="relative">
                <input
                  className="form-input flex w-full min-w-0 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-slate-300 dark:border-[#324d67] bg-white dark:bg-[#192633] focus:border-primary dark:focus:border-primary h-14 placeholder:text-slate-400 dark:placeholder:text-[#92adc9] px-4 text-base font-normal leading-normal transition-all"
                  placeholder="PokerKing123"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </label>

            {error && (
              <p className="text-red-500 text-sm text-center opacity-0">{error}</p>
            )}

            <div className="pt-4 opacity-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-primary hover:bg-blue-600 text-white font-bold text-base rounded-full shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                ) : (
                  <>
                    <span>进入大厅</span>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </AnimatedPage>
  );
}
