import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import anime from 'animejs/lib/anime.es.js';
import Avatar from './Avatar';
import PokerCardDisp from './PokerCardDisp';

interface LuckyHandsTVDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    players: any[];
    allLuckyHands: any[];
    luckyHandsCount: number;
}

export default function LuckyHandsTVDashboard({
    isOpen,
    onClose,
    players,
    allLuckyHands,
    luckyHandsCount
}: LuckyHandsTVDashboardProps) {
    const [isPortrait, setIsPortrait] = useState(false);
    const [mounted, setMounted] = useState(false);

    // 用于内部拦截闪烁提示的 Toast
    const [hitToastParams, setHitToastParams] = useState<{ username: string, targetHand: number, hitCount: number } | null>(null);
    const prevHandsRef = useRef<any[]>([]);

    // 监听 hand 数据变化并触发亮起
    useEffect(() => {
        if (!isOpen) {
            prevHandsRef.current = [];
            return;
        }

        const prevHands = prevHandsRef.current;
        if (prevHands.length > 0 && allLuckyHands.length > 0) {
            // 找出 hit_count 增加的 hand
            allLuckyHands.forEach(currHand => {
                const prevHand = prevHands.find(p => p.id === currHand.id);
                if (prevHand && currHand.hit_count > prevHand.hit_count) {

                    // 找到对应的 player 拿到名字
                    const owner = players.find(p => p.user_id === currHand.user_id);
                    if (owner) {
                        const name = owner.users?.username || '某人';

                        // 触发闪屏
                        anime({
                            targets: `.tv-row-${owner.id}`,
                            backgroundColor: ['rgba(234, 179, 8, 0.4)', 'rgba(255, 255, 255, 0)', 'rgba(234, 179, 8, 0.2)', 'rgba(51, 65, 85, 0)'],
                            duration: 2000,
                            easing: 'easeInOutQuad',
                        });

                        // 弹窗公告
                        setHitToastParams({
                            username: name,
                            targetHand: currHand.hand_index,
                            hitCount: currHand.hit_count
                        });

                        // 3秒后自动清除
                        setTimeout(() => setHitToastParams(null), 3500);
                    }
                }
            });
        }

        prevHandsRef.current = JSON.parse(JSON.stringify(allLuckyHands));
    }, [allLuckyHands, players, isOpen]);

    useEffect(() => {
        setMounted(true);
        const checkOrientation = () => {
            setIsPortrait(window.innerHeight > window.innerWidth);
        };

        // 初始检查
        checkOrientation();

        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] bg-[#0a0f16] flex flex-col text-white animate-in fade-in zoom-in-95 duration-300">
            {/* 悬浮关闭按钮，不占据文档流高度 */}
            <button
                onClick={onClose}
                className="absolute top-3 right-4 z-[200000] size-10 md:size-12 rounded-full bg-slate-800/80 border border-slate-600 shadow-xl hover:bg-slate-700 flex items-center justify-center transition-colors active:scale-95"
            >
                <span className="material-symbols-outlined text-2xl md:text-3xl text-slate-300">close</span>
            </button>

            {isPortrait ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <span className="material-symbols-outlined text-6xl text-slate-500 mb-6 animate-pulse" style={{ transform: 'rotate(90deg)' }}>screen_rotation</span>
                    <h2 className="text-2xl font-bold text-slate-300 mb-3">为获得最佳大屏体验</h2>
                    <p className="text-slate-500 max-w-sm">请将您的设备横向放置或全屏投射至横向电视面板，以展示最完整的玩家矩阵手牌数据极简列表。</p>
                </div>
            ) : (
                <main className="flex-1 overflow-auto no-scrollbar relative">

                    {/* 内置拦截通知框 */}
                    {hitToastParams && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[300000] animate-in zoom-in spin-in-12 fade-in duration-700 pointer-events-none">
                            <div className="bg-gradient-to-br from-yellow-500/90 to-amber-700/90 backdrop-blur-md px-10 py-8 rounded-3xl shadow-[0_0_80px_rgba(234,179,8,0.5)] border-2 border-yellow-300/50 flex flex-col items-center">
                                <span className="material-symbols-outlined text-7xl text-yellow-100 mb-2 drop-shadow-xl animate-bounce">celebration</span>
                                <h1 className="text-4xl md:text-5xl font-black text-white text-center tracking-wider drop-shadow-md">
                                    <span className="text-yellow-200">{hitToastParams.username}</span> 达成了
                                </h1>
                                <h2 className="text-2xl md:text-3xl font-bold text-amber-100 mt-2 text-center">
                                    幸运牌型 {hitToastParams.targetHand}
                                    <span className="ml-3 bg-yellow-950/40 px-3 py-1 rounded-full text-yellow-300 border border-yellow-500/50 shadow-inner">
                                        累计 {hitToastParams.hitCount} 次
                                    </span>
                                </h2>
                            </div>
                        </div>
                    )}

                    {/* 无边界 全向滑动的表格视图 */}
                    <div className="w-full h-full min-h-full min-w-max flex flex-col pb-16">

                        {/* 表头 (Grid Row) */}
                        <div
                            className="grid gap-2 p-2 md:p-3 bg-slate-800/95 border-b border-slate-700/80 text-slate-400 font-bold uppercase tracking-wider text-xs md:text-sm sticky top-0 z-20 shadow-md"
                            style={{ gridTemplateColumns: `minmax(140px, 1.5fr) repeat(${luckyHandsCount || 1}, minmax(140px, 1fr))` }}
                        >
                            <div className="pl-2 md:pl-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-500 text-lg">emoji_events</span>
                                龙虎榜
                            </div>
                            {Array.from({ length: luckyHandsCount }).map((_, i) => (
                                <div key={i} className="text-center">幸运牌型 {i + 1}</div>
                            ))}
                        </div>

                        {/* 表身 */}
                        <div className="flex flex-col flex-1">
                            {players.filter(p => allLuckyHands.some(h => h.user_id === p.user_id)).map((player, pIdx) => {
                                const userHands = allLuckyHands.filter(h => h.user_id === player.user_id);

                                return (
                                    <div
                                        key={player.id}
                                        className={`tv-row-${player.id} grid gap-2 p-2 md:p-3 items-center transition-colors border-b border-slate-700/30`}
                                        style={{ gridTemplateColumns: `minmax(140px, 1.5fr) repeat(${luckyHandsCount || 1}, minmax(140px, 1fr))` }}
                                    >

                                        {/* Column 1: 用户信息 */}
                                        <div className="flex items-center gap-3 pl-2 md:pl-4">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow-md ring-2 ring-slate-700/50 bg-slate-900 flex-shrink-0">
                                                <Avatar username={player.users?.username || '?'} className="w-full h-full" />
                                            </div>
                                            <h2 className="text-sm md:text-base lg:text-lg font-bold text-slate-100 truncate">
                                                {player.users?.username}
                                            </h2>
                                        </div>

                                        {/* Column 2+: 各个槽位的展示 */}
                                        {Array.from({ length: luckyHandsCount }).map((_, i) => {
                                            const hand = userHands.find(h => h.hand_index === i + 1);
                                            return (
                                                <div key={i} className="flex justify-center items-center">
                                                    <div className="flex items-center gap-3">
                                                        {hand ? (
                                                            <>
                                                                <div className="flex items-center gap-1.5 md:gap-2">
                                                                    <PokerCardDisp card={hand.card_1} className="text-[12px] md:text-[14px] px-1 shadow-sm" />
                                                                    <PokerCardDisp card={hand.card_2} className="text-[12px] md:text-[14px] px-1 shadow-sm" />
                                                                </div>
                                                                {hand.hit_count > 0 && (
                                                                    <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 text-xs md:text-sm font-black px-2 py-0.5 rounded shadow flex items-center gap-0.5">
                                                                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">close</span>
                                                                        {hand.hit_count}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-slate-600 font-bold tracking-widest text-xs opacity-40">
                                                                未配置
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            )}
        </div>,
        document.body
    );
}
