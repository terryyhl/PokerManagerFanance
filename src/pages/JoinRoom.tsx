import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi } from '../lib/api';
import { useUser } from '../contexts/UserContext';

export default function JoinRoom() {
  const navigate = useNavigate();
  const { roomCode: urlRoomCode } = useParams<{ roomCode?: string }>();
  const { user } = useUser();
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const keypadRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const autoJoinTriedRef = useRef(false);

  useEffect(() => {
    anime({
      targets: contentRef.current?.children,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: anime.stagger(100)
    });

    anime({
      targets: keypadRef.current,
      translateY: [100, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutExpo',
      delay: 300
    });
  }, []);

  // URL 含房间码时自动填充并自动加入
  useEffect(() => {
    if (urlRoomCode && urlRoomCode.length === 6 && /^\d{6}$/.test(urlRoomCode) && !autoJoinTriedRef.current) {
      autoJoinTriedRef.current = true;
      setPin(urlRoomCode.split(''));
    }
  }, [urlRoomCode]);

  // pin 填满 6 位且来自 URL 自动填充时，自动提交
  useEffect(() => {
    if (autoJoinTriedRef.current && pin.join('').length === 6 && user && !isLoading) {
      handleSubmit();
    }
  }, [pin, user]);

  const handleKeypadClick = (value: string) => {
    if (value === 'backspace') {
      const newPin = [...pin];
      for (let i = 5; i >= 0; i--) {
        if (newPin[i] !== '') {
          newPin[i] = '';
          setPin(newPin);
          break;
        }
      }
    } else {
      const newPin = [...pin];
      for (let i = 0; i < 6; i++) {
        if (newPin[i] === '') {
          newPin[i] = value;
          setPin(newPin);
          break;
        }
      }
    }
  };

  const handleSubmit = async () => {
    const roomCode = pin.join('');
    if (roomCode.length !== 6) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { game } = await gamesApi.join(roomCode, user.id);
      navigate(`/game/${game.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || '房间不存在或已结束');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedPage animationType="slide-up">
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 flex items-center justify-center min-h-full h-full">
        <div className="relative w-full h-full min-h-full flex flex-col">
          <div className="flex items-center px-4 py-4 justify-between bg-background-light dark:bg-background-dark sticky top-0 z-10">
            <button
              onClick={() => navigate(-1)}
              className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center">加入私密房间</h2>
            <div className="w-10" />
          </div>

          <div ref={contentRef} className="flex-1 flex flex-col items-center pt-8 px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 text-primary opacity-0">
              <span className="material-symbols-outlined text-[32px]">lock</span>
            </div>
            <h2 className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold leading-tight text-center mb-3 opacity-0">输入房间密码</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed text-center max-w-[280px] opacity-0">
              请输入房主提供的6位访问码以加入牌局。
            </p>

            <div className="flex justify-center w-full py-10 opacity-0">
              <fieldset className="flex gap-2 sm:gap-3 justify-center w-full">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputsRef.current[index] = el}
                    className="flex h-14 w-10 sm:w-12 text-center bg-transparent border-b-2 border-slate-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary text-2xl font-semibold outline-none transition-colors caret-primary text-slate-900 dark:text-white placeholder-slate-400"
                    inputMode="numeric"
                    maxLength={1}
                    placeholder="•"
                    type="text"
                    value={digit}
                    readOnly
                  />
                ))}
              </fieldset>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mb-4">{error}</p>
            )}

            <div className="flex-1"></div>

            <div className="w-full pb-8 flex flex-col gap-3 opacity-0">
              <button
                onClick={handleSubmit}
                disabled={isLoading || pin.join('').length !== 6}
                className="w-full h-12 rounded-xl bg-primary hover:bg-blue-600 text-white text-base font-bold leading-normal tracking-wide shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                ) : '确认进入'}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full h-12 rounded-xl bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-base font-medium leading-normal tracking-wide transition-colors"
              >
                取消
              </button>
            </div>
          </div>

          <div ref={keypadRef} className="bg-slate-100 dark:bg-[#15202b] pt-4 pb-4 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)] opacity-0">
            <div className="grid grid-cols-3 gap-y-4 gap-x-6 px-6 max-w-[320px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeypadClick(num.toString())}
                  className="h-14 rounded-lg text-2xl font-medium text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setPin(['', '', '', '', '', ''])}
                className="h-14 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95 text-xs font-medium"
              >
                清空
              </button>
              <button
                onClick={() => handleKeypadClick('0')}
                className="h-14 rounded-lg text-2xl font-medium text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => handleKeypadClick('backspace')}
                className="h-14 rounded-lg flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[24px]">backspace</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
