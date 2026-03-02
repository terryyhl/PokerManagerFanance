import React, { useState, useCallback, useRef } from 'react';

type CoinResult = 'heads' | 'tails' | null;

export default function CoinFlip() {
    const [result, setResult] = useState<CoinResult>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [flipCount, setFlipCount] = useState(0);
    const [stats, setStats] = useState({ heads: 0, tails: 0 });
    const [flipAnim, setFlipAnim] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFlip = useCallback(() => {
        if (isFlipping) return;

        const isHeads = Math.random() < 0.5;
        const newResult: CoinResult = isHeads ? 'heads' : 'tails';

        setIsFlipping(true);
        setResult(null);
        // heads: 停在偶数个180°(正面朝前), tails: 停在奇数个180°(反面朝前)
        setFlipAnim(isHeads ? 'coin-to-heads' : 'coin-to-tails');

        if (navigator.vibrate) navigator.vibrate(50);

        timerRef.current = setTimeout(() => {
            setResult(newResult);
            setIsFlipping(false);
            setFlipCount(prev => prev + 1);
            setStats(prev => ({
                ...prev,
                [newResult]: prev[newResult] + 1,
            }));
        }, 1800);
    }, [isFlipping]);

    const handleReset = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setResult(null);
        setIsFlipping(false);
        setFlipCount(0);
        setStats({ heads: 0, tails: 0 });
        setFlipAnim('');
    };

    const resultText = result === 'heads' ? '正面' : result === 'tails' ? '反面' : null;
    const resultColor = result === 'heads' ? 'text-amber-600' : result === 'tails' ? 'text-slate-500' : '';

    // 结果出来后硬币停在对应面
    const restTransform = result === 'tails' ? 'rotateY(180deg)' : 'rotateY(0deg)';

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-center p-5 pt-8">
                <h2 className="text-xl font-bold">掷硬币</h2>
            </div>

            {/* 主内容 */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 pb-24">

                {/* 硬币 3D 区域 */}
                <div className="coin-scene mb-6">
                    <div
                        className={`coin ${isFlipping ? flipAnim : ''}`}
                        style={!isFlipping && result ? { transform: restTransform } : undefined}
                    >
                        {/* 正面 — 金色 */}
                        <div className="coin-face coin-heads">
                            <div className="coin-inner-ring">
                                <div className="coin-content">
                                    <span className="coin-value">1</span>
                                    <span className="coin-label">HEADS</span>
                                </div>
                            </div>
                        </div>

                        {/* 反面 — 银色 */}
                        <div className="coin-face coin-tails">
                            <div className="coin-inner-ring">
                                <div className="coin-content">
                                    <span className="coin-star">★</span>
                                    <span className="coin-label">TAILS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 结果文字 */}
                <div className="h-12 flex items-center justify-center mb-6">
                    {isFlipping ? (
                        <span className="text-sm font-bold text-slate-400 animate-pulse">硬币翻转中...</span>
                    ) : result ? (
                        <span className={`text-3xl font-black result-pop ${resultColor}`}>{resultText}!</span>
                    ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">点击下方按钮掷硬币</span>
                    )}
                </div>

                {/* 掷硬币按钮 */}
                <button
                    onClick={handleFlip}
                    disabled={isFlipping}
                    className={`px-10 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 mb-6 ${isFlipping
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105'
                        }`}
                >
                    <span className="material-symbols-outlined text-[20px] mr-2 align-middle">casino</span>
                    {flipCount === 0 ? '掷硬币' : '再掷一次'}
                </button>

                {/* 统计 */}
                {flipCount > 0 && (
                    <div className="flex items-center gap-6 mb-4">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-amber-600">{stats.heads}</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">正面</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-500">{flipCount} 次</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">总计</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-slate-500">{stats.tails}</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-wider">反面</span>
                        </div>
                    </div>
                )}

                {/* 重置 */}
                {flipCount > 0 && !isFlipping && (
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        重置统计
                    </button>
                )}
            </div>

            <style>{`
                /* ─── 硬币 3D 场景 ─── */
                .coin-scene {
                    width: 180px;
                    height: 180px;
                    perspective: 600px;
                }
                .coin {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    transform-style: preserve-3d;
                    transition: transform 0.3s ease;
                }

                /* ─── 正面 & 反面通用 ─── */
                .coin-face {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    backface-visibility: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    /* 硬币边缘厚度感 */
                    box-shadow:
                        0 4px 15px rgba(0,0,0,0.2),
                        0 0 0 4px rgba(0,0,0,0.06),
                        inset 0 2px 8px rgba(255,255,255,0.4),
                        inset 0 -3px 6px rgba(0,0,0,0.1);
                }
                .coin-inner-ring {
                    width: 82%;
                    height: 82%;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid rgba(255,255,255,0.15);
                }
                .coin-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                /* ─── 正面 — 金色 ─── */
                .coin-heads {
                    background: radial-gradient(circle at 38% 35%,
                        #fde68a 0%, #f59e0b 30%, #d97706 60%, #b45309 90%);
                    border: 3px solid #92400e;
                }
                .coin-heads .coin-inner-ring {
                    border-color: rgba(146, 64, 14, 0.3);
                    box-shadow: inset 0 0 20px rgba(180, 83, 9, 0.2);
                }
                .coin-value {
                    font-size: 56px;
                    font-weight: 900;
                    color: #78350f;
                    line-height: 1;
                    text-shadow: 0 1px 0 rgba(255,255,255,0.3), 0 -1px 0 rgba(0,0,0,0.1);
                }

                /* ─── 反面 — 银色 ─── */
                .coin-tails {
                    transform: rotateY(180deg);
                    background: radial-gradient(circle at 38% 35%,
                        #f1f5f9 0%, #cbd5e1 30%, #94a3b8 60%, #64748b 90%);
                    border: 3px solid #475569;
                }
                .coin-tails .coin-inner-ring {
                    border-color: rgba(71, 85, 105, 0.3);
                    box-shadow: inset 0 0 20px rgba(100, 116, 139, 0.2);
                }
                .coin-star {
                    font-size: 52px;
                    font-weight: 900;
                    color: #334155;
                    line-height: 1;
                    text-shadow: 0 1px 0 rgba(255,255,255,0.4), 0 -1px 0 rgba(0,0,0,0.1);
                }
                .coin-label {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.15em;
                    opacity: 0.5;
                    margin-top: 2px;
                }
                .coin-heads .coin-label { color: #78350f; }
                .coin-tails .coin-label { color: #334155; }

                /* ─── 翻转动画 — 正面结果 ─── */
                @keyframes coin-to-heads {
                    0%   { transform: rotateY(0deg)    translateY(0); }
                    10%  { transform: rotateY(180deg)  translateY(-60px); }
                    20%  { transform: rotateY(360deg)  translateY(-100px); }
                    30%  { transform: rotateY(540deg)  translateY(-120px); }
                    40%  { transform: rotateY(720deg)  translateY(-110px); }
                    50%  { transform: rotateY(900deg)  translateY(-80px); }
                    60%  { transform: rotateY(1080deg) translateY(-50px); }
                    70%  { transform: rotateY(1260deg) translateY(-25px); }
                    80%  { transform: rotateY(1440deg) translateY(-8px); }
                    90%  { transform: rotateY(1620deg) translateY(-2px); }
                    100% { transform: rotateY(1800deg) translateY(0); }
                }
                .coin-to-heads { animation: coin-to-heads 1.8s ease-out forwards; }

                /* ─── 翻转动画 — 反面结果（多半圈 = 奇数×180°）─── */
                @keyframes coin-to-tails {
                    0%   { transform: rotateY(0deg)    translateY(0); }
                    10%  { transform: rotateY(180deg)  translateY(-60px); }
                    20%  { transform: rotateY(360deg)  translateY(-100px); }
                    30%  { transform: rotateY(540deg)  translateY(-120px); }
                    40%  { transform: rotateY(720deg)  translateY(-110px); }
                    50%  { transform: rotateY(900deg)  translateY(-80px); }
                    60%  { transform: rotateY(1080deg) translateY(-50px); }
                    70%  { transform: rotateY(1260deg) translateY(-25px); }
                    80%  { transform: rotateY(1440deg) translateY(-8px); }
                    90%  { transform: rotateY(1620deg) translateY(-2px); }
                    100% { transform: rotateY(1980deg) translateY(0); }
                }
                .coin-to-tails { animation: coin-to-tails 1.8s ease-out forwards; }

                /* ─── 结果弹入 ─── */
                @keyframes result-pop {
                    0% { opacity: 0; transform: scale(0.3) translateY(10px); }
                    50% { opacity: 1; transform: scale(1.1) translateY(-2px); }
                    70% { transform: scale(0.95) translateY(0); }
                    100% { transform: scale(1) translateY(0); }
                }
                .result-pop {
                    animation: result-pop 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}
