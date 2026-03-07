import React, { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import AuthLoading from '../components/AuthLoading';
import { useUser } from '../contexts/UserContext';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, hydrated } = useUser();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated || user) return;

    const tl = anime.timeline({
      easing: 'easeOutExpo',
      duration: 800
    });

    tl.add({
      targets: iconRef.current,
      translateY: [50, 0],
      opacity: [0, 1],
      scale: [0.8, 1],
      delay: 200
    })
    .add({
      targets: titleRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
    }, '-=600')
    .add({
      targets: subtitleRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
    }, '-=600')
    .add({
      targets: buttonsRef.current?.children,
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(100)
    }, '-=600');

    return () => {
      tl.pause();
      anime.remove(iconRef.current);
      anime.remove(titleRef.current);
      anime.remove(subtitleRef.current);
      anime.remove(buttonsRef.current?.children || []);
    };
  }, [hydrated, user]);

  if (!hydrated) {
    return <AuthLoading />;
  }

  if (user) {
    return <Navigate to="/lobby" replace />;
  }

  return (
    <AnimatedPage>
      <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-background-dark">
        <div className="absolute inset-0 z-0">
          <div 
            className="h-full w-full bg-cover bg-center" 
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCv2187FhzbqM2hYQRpVxGuVyedegPkKYry_XQ2ifPTk5-HC5EfJIqvVDPvZbvwAqLqbKHvzkrXCVp3odWbe5DK-V7zwPAI7bgwcBsmMAhnWylYJrmOwJXL1C9BCS8ehGhwkgbdLr-dX-z_L7sPunUW_51edfSX3I6KBo7D11UFZP_PJ96gKXKOFwILi5mOpMbA03j85YTJlE7fu3gmcc-lVMG6yp652-8vyWG1_Et4VOWkfieMo6h2_-A_LXiM5myoba-D3uiuwjJs")' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 flex w-full justify-between p-4" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}></div>
        
        <div className="relative z-10 flex flex-col items-center justify-end h-full px-6 pb-12 w-full max-w-md mx-auto">
          <div ref={iconRef} className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 shadow-2xl shadow-primary/30 opacity-0">
            <span className="material-symbols-outlined text-5xl text-white">playing_cards</span>
          </div>
          
          <div className="flex flex-col items-center text-center space-y-4 mb-10">
            <h1 ref={titleRef} className="text-white text-4xl font-black tracking-tight leading-tight opacity-0">
              扑克俱乐部<br/>管理
            </h1>
            <p ref={subtitleRef} className="text-slate-300 text-lg font-normal leading-relaxed max-w-[300px] opacity-0">
              自动追踪买入，即时结算私人对局。
            </p>
          </div>
          
          <div ref={buttonsRef} className="flex w-full flex-col gap-3">
            <button 
              onClick={() => navigate('/login')}
              className="group flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary h-14 px-5 text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98] hover:bg-primary/90 opacity-0"
            >
              <span className="text-lg font-bold tracking-wide">进入俱乐部</span>
              <span className="material-symbols-outlined ml-2 text-xl transition-transform group-hover:translate-x-1">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
