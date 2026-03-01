import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
                <main className="flex-1 overflow-auto no-scrollbar">
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
                            {players.map((player, pIdx) => {
                                const userHands = allLuckyHands.filter(h => h.user_id === player.user_id);

                                return (
                                    <div
                                        key={player.id}
                                        className={`grid gap-2 p-2 md:p-3 items-center transition-colors hover:bg-slate-700/30 ${pIdx !== players.length - 1 ? 'border-b border-slate-700/30' : ''}`}
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
                                                    <div className={`flex flex-col items-center justify-center w-[54px] h-[60px] md:w-[64px] md:h-[70px] rounded-xl border-2 relative transition-all
                                                    ${hand ? (hand.hit_count > 0 ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-indigo-500/30 bg-indigo-900/20') : 'border-slate-700/50 border-dashed bg-slate-800/10'}
                                                `}>
                                                        {hand && hand.hit_count > 0 && (
                                                            <div className="absolute -top-3 w-full flex justify-center z-10">
                                                                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 text-[10px] md:text-xs font-black px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 transform -skew-x-6">
                                                                    <span className="material-symbols-outlined text-[10px] md:text-[12px]">star</span>
                                                                    ×{hand.hit_count}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {hand ? (
                                                            <div className="flex -space-x-3 md:-space-x-4">
                                                                <PokerCardDisp card={hand.card_1} className="text-[10px] md:text-[12px] px-1 shadow-md transition-transform hover:-translate-y-1 hover:rotate-[-5deg]" />
                                                                <PokerCardDisp card={hand.card_2} className="text-[10px] md:text-[12px] px-1 shadow-md transition-transform hover:-translate-y-1 hover:rotate-[5deg]" />
                                                            </div>
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
