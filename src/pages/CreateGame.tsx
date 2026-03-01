import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi } from '../lib/api';
import { useUser } from '../contexts/UserContext';

export default function CreateGame() {
  const navigate = useNavigate();
  const { user } = useUser();
  const formRef = useRef<HTMLDivElement>(null);
  const [selectedBlind, setSelectedBlind] = useState('1/2');
  const [customBlind, setCustomBlind] = useState('');
  const [isCustomBlind, setIsCustomBlind] = useState(false);
  const [insurance, setInsurance] = useState(true);
  const [roomName, setRoomName] = useState('Friday Night Poker');
  const [minBuyin, setMinBuyin] = useState(100);
  const [maxBuyin, setMaxBuyin] = useState(400);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    anime({
      targets: formRef.current?.children,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: anime.stagger(100)
    });
  }, []);

  const blinds = ['1/2', '2/4', '5/10', '10/20', '25/50', '50/100'];

  const handleCreate = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!roomName.trim()) {
      setError('请输入房间名称');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { game } = await gamesApi.create({
        name: roomName.trim(),
        blindLevel: isCustomBlind && customBlind.trim() ? customBlind.trim() : selectedBlind,
        minBuyin,
        maxBuyin,
        insuranceMode: insurance,
        userId: user.id,
      });
      // 直接进入牌局，并替换当前历史记录（关闭创建页面）
      navigate(`/game/${game.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || '创建游戏失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <AnimatedPage animationType="slide-up">
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-full h-full flex flex-col">



        <header className="flex items-center justify-between p-4 sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight flex-1 text-center pr-10 text-slate-900 dark:text-white">创建牌局</h1>
        </header>

        <main ref={formRef} className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-lg mx-auto w-full overflow-y-auto">
          {/* 房间名称 */}
          <div className="space-y-2 opacity-0">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="room-name">房间名称</label>
            <div className="relative">
              <input
                className="block w-full h-12 px-4 rounded-xl bg-white dark:bg-[#192633] border border-slate-300 dark:border-[#324d67] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92adc9] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                id="room-name"
                placeholder="例如：周五德州之夜"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-[#92adc9]">
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </div>
            </div>
          </div>

          {/* 盲注级别 */}
          <div className="space-y-3 opacity-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">盲注级别 (Small/Big Blinds)</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {blinds.map((blind) => (
                <button
                  key={blind}
                  onClick={() => {
                    setSelectedBlind(blind);
                    setIsCustomBlind(false);
                  }}
                  className={`flex h-10 items-center justify-center rounded-lg font-medium transition-all ${(!isCustomBlind && selectedBlind === blind)
                    ? 'bg-primary text-white font-semibold shadow-md shadow-primary/20'
                    : 'bg-slate-200 dark:bg-[#233648] text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#2a4055]'
                    }`}
                >
                  {blind}
                </button>
              ))}
              <div
                onClick={() => setIsCustomBlind(true)}
                className={`col-span-2 relative flex h-10 items-center overflow-hidden rounded-lg transition-all border ${isCustomBlind
                  ? 'border-primary ring-1 ring-primary/50'
                  : 'border-transparent bg-slate-200 dark:bg-[#233648] hover:bg-slate-300 dark:hover:bg-[#2a4055]'
                  }`}
              >
                <input
                  type="text"
                  placeholder="自定义 (例 100/200)"
                  value={customBlind}
                  onChange={(e) => {
                    setCustomBlind(e.target.value);
                    setIsCustomBlind(true);
                  }}
                  onFocus={() => setIsCustomBlind(true)}
                  className={`w-full h-full pl-3 pr-2 bg-transparent text-sm outline-none ${isCustomBlind ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                />
              </div>
            </div>
          </div>

          {/* 买入范围 */}
          <div className="grid grid-cols-2 gap-4 opacity-0">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">最小买入</label>
              <div className="relative">
                <input className="block w-full h-12 px-4 pr-12 rounded-xl bg-white dark:bg-[#192633] border border-slate-300 dark:border-[#324d67] text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono" type="number" value={minBuyin} onChange={(e) => setMinBuyin(parseInt(e.target.value) || 0)} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-[#92adc9] text-sm">积分</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">最大买入</label>
              <div className="relative">
                <input className="block w-full h-12 px-4 pr-12 rounded-xl bg-white dark:bg-[#192633] border border-slate-300 dark:border-[#324d67] text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono" type="number" value={maxBuyin} onChange={(e) => setMaxBuyin(parseInt(e.target.value) || 0)} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-[#92adc9] text-sm">积分</span>
              </div>
            </div>
          </div>

          {/* 带入审核 */}
          <div className="flex items-center justify-between py-2 border-t border-slate-200 dark:border-slate-800 mt-2 opacity-0">
            <div className="flex flex-col">
              <span className="text-base font-medium text-slate-900 dark:text-white">带入审核</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">启用后，玩家买入需房主审核确认</span>
            </div>
            <div
              onClick={() => setInsurance(!insurance)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${insurance ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${insurance ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
        </main>

        <div className="p-4 bg-background-light dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-10 pb-8">
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined">play_circle</span>
                创建并开始游戏
              </>
            )}
          </button>
        </div>
      </div>
    </AnimatedPage>
  );
}
