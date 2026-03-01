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
    const [isPortrait, setIsPortrait] = React.useState(false);

    React.useEffect(() => {
        const checkOrientation = () => {
            setIsPortrait(window.innerHeight > window.innerWidth);
        };

        // 初始检查
        checkOrientation();

        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

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

            {isPortrait ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <span className="material-symbols-outlined text-6xl text-slate-500 mb-6 animate-pulse" style={{ transform: 'rotate(90deg)' }}>screen_rotation</span>
                    <h2 className="text-2xl font-bold text-slate-300 mb-3">为获得最佳大屏体验</h2>
                    <p className="text-slate-500 max-w-sm">请将您的设备横向放置或全屏投射至横向电视面板，以展示最完整的玩家矩阵手牌数据极简列表。</p>
                </div>
            ) : (
                <main className="flex-1 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8 no-scrollbar">
                    {/* 类似 Excel 的紧凑表格视图 */}
                    <div className="w-full h-full min-h-full border border-slate-700/50 rounded-2xl overflow-hidden bg-slate-800/40 shadow-2xl flex flex-col">

                        {/* 表头 (Grid Row) */}
                        <div className="grid grid-cols-[minmax(240px,1.5fr)_repeat(auto-fit,minmax(200px,1fr))] gap-4 p-4 md:p-6 bg-slate-800/80 border-b border-slate-700/80 text-slate-400 font-bold uppercase tracking-wider text-sm md:text-lg">
                            <div className="pl-4 md:pl-8">玩家列表</div>
                            {Array.from({ length: luckyHandsCount }).map((_, i) => (
                                <div key={i} className="text-center">幸运牌型 {i + 1}</div>
                            ))}
                        </div>

                        {/* 表身 */}
                        <div className="flex flex-col flex-1 pb-16">
                            {players.map((player, pIdx) => {
                                const userHands = allLuckyHands.filter(h => h.user_id === player.user_id);

                                return (
                                    <div key={player.id} className={`grid grid-cols-[minmax(240px,1.5fr)_repeat(auto-fit,minmax(200px,1fr))] gap-4 p-4 md:p-6 items-center transition-colors hover:bg-slate-700/30 ${pIdx !== players.length - 1 ? 'border-b border-slate-700/30' : ''}`}>

                                        {/* Column 1: 用户信息 */}
                                        <div className="flex items-center gap-4 md:gap-6 pl-4 md:pl-8">
                                            <div className="w-16 h-16 rounded-full lg:w-20 lg:h-20 xl:w-24 xl:h-24 shadow-lg ring-4 ring-slate-700/50 bg-slate-900 flex-shrink-0">
                                                <Avatar username={player.users?.username || '?'} className="w-full h-full" />
                                            </div>
                                            <h2 className="text-xl lg:text-3xl font-bold text-slate-100 truncate">
                                                {player.users?.username}
                                            </h2>
                                        </div>

                                        {/* Column 2+: 各个槽位的展示 */}
                                        {Array.from({ length: luckyHandsCount }).map((_, i) => {
                                            const hand = userHands.find(h => h.hand_index === i + 1);
                                            return (
                                                <div key={i} className="flex justify-center items-center">
                                                    <div className={`flex flex-col items-center justify-center w-[100px] h-[120px] xl:w-[130px] xl:h-[150px] 2xl:w-[150px] 2xl:h-[180px] rounded-2xl border-2 relative transition-all
                                                    ${hand ? (hand.hit_count > 0 ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-indigo-500/30 bg-indigo-900/20') : 'border-slate-700/50 border-dashed bg-slate-800/10'}
                                                `}>
                                                        {hand && hand.hit_count > 0 && (
                                                            <div className="absolute -top-4 w-full flex justify-center z-10">
                                                                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 text-base md:text-lg font-black px-3 py-0.5 rounded-lg shadow-lg flex items-center gap-1 transform -skew-x-6">
                                                                    <span className="material-symbols-outlined text-[16px] md:text-[20px]">star</span>
                                                                    ×{hand.hit_count}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {hand ? (
                                                            <div className="flex -space-x-4 xl:-space-x-6">
                                                                <PokerCardDisp card={hand.card_1} className="text-[18px] md:text-[22px] xl:text-[28px] px-1.5 xl:px-2 shadow-2xl transition-transform hover:-translate-y-2 hover:rotate-[-5deg]" />
                                                                <PokerCardDisp card={hand.card_2} className="text-[18px] md:text-[22px] xl:text-[28px] px-1.5 xl:px-2 shadow-2xl transition-transform hover:-translate-y-2 hover:rotate-[5deg]" />
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-600 font-bold tracking-widest text-lg md:text-xl opacity-40">
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
        </div>
    );
}
