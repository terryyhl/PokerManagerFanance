import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { settlementApi, PlayerStat } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useGameSSE } from '../hooks/useGameSSE';
import Avatar from '../components/Avatar';

export default function PersonalBill() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const [myStat, setMyStat] = useState<PlayerStat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) return;
      try {
        const { stats } = await settlementApi.get(id);
        const me = stats.find(s => s.userId === user.id);
        setMyStat(me || null);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  useGameSSE(id, user?.id, {
    onGameSettled: () => {
      // 当游戏结算时，自动跳转到结算报告页面
      navigate(`/settlement/${id}`, { replace: true });
    }
  });

  useEffect(() => {
    if (!isLoading && !hasAnimated.current) {
      hasAnimated.current = true;
      if (!contentRef.current) return;
      anime({
        targets: contentRef.current.children,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutExpo',
        delay: anime.stagger(100)
      });
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  if (error) {
    return (
      <AnimatedPage animationType="slide-left">
        <div className="flex flex-col items-center justify-center h-full gap-3 bg-background-light dark:bg-background-dark text-slate-400">
          <span className="material-symbols-outlined text-4xl">error_outline</span>
          <p className="text-sm">加载失败，请返回后重试</p>
          <button onClick={() => navigate(-1)} className="mt-2 text-primary text-sm font-bold">返回</button>
        </div>
      </AnimatedPage>
    );
  }

  const netProfit = myStat ? myStat.netProfit : 0;
  const isProfit = netProfit >= 0;

  return (
    <AnimatedPage animationType="slide-left">
      <div className="bg-background-light dark:bg-background-dark min-h-full h-full text-slate-900 dark:text-slate-100 font-display antialiased overflow-hidden flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm px-4 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
            </button>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">个人账单</h2>
          </div>
        </header>

        <main ref={contentRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 relative">
          {/* 用户头像 + 游戏信息 */}
          <div className="flex flex-col items-center gap-2 opacity-0">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-surface-dark ring-2 ring-primary/40 shadow-xl bg-slate-100 dark:bg-slate-800">
              <Avatar username={user?.username || '?'} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">{user?.username || '玩家'}</h3>
              <p className="text-xs text-slate-400">游戏账单</p>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-3 opacity-0">
            <div className="bg-white dark:bg-surface-dark rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">总买入</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{myStat?.totalBuyin ?? 0} 积分</span>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">最终筹码</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{myStat?.finalChips ?? 0} 积分</span>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
              <div className={`absolute inset-0 ${isProfit ? 'bg-profit-green/10' : 'bg-red-500/10'}`}></div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mb-1 relative z-10">净盈亏</span>
              <span className={`text-lg font-bold relative z-10 ${isProfit ? 'text-profit-green' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}{netProfit} 积分
              </span>
            </div>
          </div>

          {/* 结算结果摘要 */}
          {myStat ? (
            <div className="opacity-0">
              <div className={`p-5 rounded-2xl border ${isProfit ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} text-center`}>
                <span className={`text-3xl font-black flex items-center justify-center gap-2 ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-3xl">{isProfit ? 'celebration' : 'trending_down'}</span>
                  {isProfit ? '盈利' : '亏损'} {isProfit ? '+' : ''}{netProfit} 积分
                </span>
                <p className="text-slate-400 text-sm mt-2">
                  总买入 {myStat.totalBuyin} 积分 → 带走 {myStat.finalChips} 积分
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 opacity-0 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">info</span>
              <p className="text-slate-500 text-sm">暂无结算数据。请先在游戏中提交结账。</p>
            </div>
          )}

          <div className="h-24 opacity-0"></div>
        </main>
      </div>
    </AnimatedPage>
  );
}
