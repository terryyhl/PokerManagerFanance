import React from 'react';
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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0a0f16] flex flex-col text-white animate-in fade-in zoom-in-95 duration-300">
            <header className="flex items-center justify-between p-6 md:p-8 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-yellow-500 text-4xl">emoji_events</span>
                    <h1 className="text-3xl md:text-4xl font-black tracking-wider bg-gradient-to-r from-yellow-400 to-amber-600 outline-text text-transparent bg-clip-text">幸运手牌龙虎榜</h1>
                </div>
                <button
                    onClick={onClose}
                    className="size-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors active:scale-95"
                >
                    <span className="material-symbols-outlined text-4xl">close</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 no-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {players.map(player => {
                        const userHands = allLuckyHands.filter(h => h.user_id === player.user_id);

                        return (
                            <div key={player.id} className="bg-slate-800/60 border border-slate-700/50 shadow-xl rounded-3xl p-6 flex flex-col items-center transform transition-transform hover:scale-[1.02]">
                                <div className="flex flex-col items-center mb-6">
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-2xl ring-4 ring-slate-700/50 mb-3 bg-slate-900 flex-shrink-0">
                                        <Avatar username={player.users?.username || '?'} className="w-full h-full" />
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-100 truncate w-full text-center tracking-tight">
                                        {player.users?.username}
                                    </h2>
                                </div>

                                <div className="flex gap-3 w-full justify-center">
                                    {Array.from({ length: luckyHandsCount }).map((_, i) => {
                                        const hand = userHands.find(h => h.hand_index === i + 1);
                                        return (
                                            <div key={i} className={`flex flex-col items-center justify-center w-[76px] h-[95px] md:w-[86px] md:h-[110px] rounded-2xl border-2 relative transition-all
                                                ${hand ? (hand.hit_count > 0 ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-indigo-500/50 bg-indigo-900/20') : 'border-slate-700/50 border-dashed bg-slate-800/30'}
                                            `}>
                                                {hand && hand.hit_count > 0 && (
                                                    <div className="absolute -top-3.5 w-full flex justify-center z-10">
                                                        <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 text-sm font-black px-2.5 py-0.5 rounded-lg shadow border border-yellow-300 flex items-center gap-0.5 transform -skew-x-6">
                                                            <span className="material-symbols-outlined text-[14px]">star</span>
                                                            ×{hand.hit_count}
                                                        </span>
                                                    </div>
                                                )}

                                                {hand ? (
                                                    <div className="flex flex-col items-center w-full px-1">
                                                        <div className="flex -space-x-4">
                                                            <div className="hover:z-10 transition-transform hover:-translate-y-2 hover:rotate-[-5deg]">
                                                                <PokerCardDisp card={hand.card_1} className="text-[16px] md:text-[20px] px-1.5 shadow-xl" />
                                                            </div>
                                                            <div className="hover:z-10 transition-transform hover:-translate-y-2 hover:rotate-[5deg]">
                                                                <PokerCardDisp card={hand.card_2} className="text-[16px] md:text-[20px] px-1.5 shadow-xl" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-600 font-bold tracking-widest text-lg opacity-50 border-2 border-slate-700 rounded-full w-8 h-8 flex items-center justify-center">
                                                        {i + 1}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
