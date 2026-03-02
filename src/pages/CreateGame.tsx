import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import anime from 'animejs';
import { QRCodeSVG } from 'qrcode.react';
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
  const [luckyHandsCount, setLuckyHandsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdGame, setCreatedGame] = useState<{ id: string; roomCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // 设置默认名字并引入初始入场动画
  useEffect(() => {
    if (user?.username) {
      setRoomName(`${user.username} 的牌局`);
    }

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
      navigate('/login', { replace: true });
      return;
    }
    if (!roomName.trim()) {
      setError('请输入房间名称');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { game } = await gamesApi.create(
        roomName.trim(),
        user.id,
        isCustomBlind && customBlind.trim() ? customBlind.trim() : selectedBlind,
        minBuyin,
        maxBuyin,
        insurance,
        luckyHandsCount
      );
      // 先显示房间密码，让房主分享给其他玩家
      setCreatedGame({ id: game.id, roomCode: game.room_code });
    } catch (err: any) {
      setError(err.message || '创建游戏失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };



  const handleCopyCode = () => {
    if (!createdGame) return;
    navigator.clipboard.writeText(createdGame.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 创建成功 → 显示房间密码页
  if (createdGame) {
    return (
      <AnimatedPage animationType="slide-up">
        <div className="bg-[#0f1923] min-h-full h-full flex flex-col items-center justify-center text-white px-6">
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-emerald-400 text-[36px]">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">房间创建成功</h2>
            <p className="text-slate-400 text-sm mb-8">将房间密码分享给其他玩家，即可加入牌局</p>

            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-3">房间密码</p>
            <div className="flex justify-center gap-2 mb-6">
              {createdGame.roomCode.split('').map((d, i) => (
                <span key={i} className="w-11 h-14 flex items-center justify-center bg-slate-800 rounded-xl text-2xl font-black text-white border border-slate-700">
                  {d}
                </span>
              ))}
            </div>

            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-sm font-medium mb-5"
            >
              <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
              {copied ? '已复制！' : '复制密码'}
            </button>

            {/* 扫码加入二维码 */}
            <div className="w-full flex flex-col items-center mb-6">
              <div className="bg-white p-3.5 rounded-xl shadow-inner mb-3">
                <QRCodeSVG
                  value={`${window.location.origin}/game/${createdGame.id}`}
                  size={160}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f1923"
                />
              </div>
              <p className="text-[11px] text-slate-500">扫码直接加入房间</p>
            </div>

            <button
              onClick={() => navigate(`/game/${createdGame.id}`, { replace: true })}
              className="w-full py-4 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-primary/25"
            >
              进入房间
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

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

          {/* 幸运手牌设置 */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 opacity-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-base font-bold text-slate-900 dark:text-white">幸运手牌</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">设置对局允许每人配置的固定手牌组数</span>
              </div>
              <span className="text-lg font-black text-primary bg-primary/10 px-3 py-1 rounded-lg">
                {luckyHandsCount === 0 ? '关闭' : `${luckyHandsCount} 组`}
              </span>
            </div>
            <div className="relative pt-2 pb-4">
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={luckyHandsCount}
                onChange={(e) => setLuckyHandsCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2 px-1 font-mono">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
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
