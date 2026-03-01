import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LuckyHandData } from './LuckyHandFAB';
import Avatar from './Avatar';
import PokerCardDisp from './PokerCardDisp';

interface PlayerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    userId: string;
    username: string;
    luckyHandsCount: number;
    onModifyLuckyHand?: (handIndex: number) => void;
    currentUserId?: string;
}

export default function PlayerStatsModal({
    isOpen,
    onClose,
    gameId,
    userId,
    username,
    luckyHandsCount,
    onModifyLuckyHand,
    currentUserId
}: PlayerStatsModalProps) {
    const [buyInRecords, setBuyInRecords] = useState<{ amount: number, type: string, created_at: string, status: string }[]>([]);
    const [luckyHands, setLuckyHands] = useState<LuckyHandData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !gameId || !userId) return;

        let isMounted = true;
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                // Fetch buyins
                const { data: buyinData, error: buyinError } = await supabase
                    .from('buy_ins')
                    .select('amount, type, created_at, status')
                    .eq('game_id', gameId)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true });

                if (!buyinError && buyinData) {
                    const validRecords = buyinData.filter(b => b.type !== 'checkout' && b.status === 'completed');
                    if (isMounted) setBuyInRecords(validRecords);
                }

                // Fetch lucky hands
                if (luckyHandsCount > 0) {
                    const { data: handsData, error: handsError } = await supabase
                        .from('lucky_hands')
                        .select('hand_index, card_1, card_2, hit_count')
                        .eq('game_id', gameId)
                        .eq('user_id', userId)
                        .order('hand_index', { ascending: true });

                    if (!handsError && handsData && isMounted) {
                        setLuckyHands(handsData as LuckyHandData[]);
                    }
                }
            } catch (err) {
                console.error('Fetch player stats error:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchStats();

        return () => { isMounted = false; };
    }, [isOpen, gameId, userId, luckyHandsCount]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-[#192633] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10 box-border text-slate-800 dark:text-slate-200 transform scale-100 transition-all">

                {/* Header Profile */}
                <div className="relative pt-12 pb-6 px-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-900/40 dark:to-purple-900/40 flex flex-col items-center border-b border-indigo-100 dark:border-indigo-900/50">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    <div className="w-20 h-20 mb-3 shadow-xl ring-4 ring-white dark:ring-[#192633] rounded-full bg-white">
                        <Avatar username={username} className="w-full h-full" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{username}</h2>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <span className="material-symbols-outlined animate-spin text-primary text-3xl">rotate_right</span>
                        </div>
                    ) : (
                        <>
                            {/* Finances */}
                            <div className="bg-slate-50 dark:bg-[#1f2e3d] rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                    买入记录流水
                                </div>
                                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto pr-1 diy-scrollbar">
                                    {buyInRecords.length > 0 ? buyInRecords.map((record, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-slate-200 dark:border-slate-700/50 last:border-0">
                                            <div className="text-slate-500 text-xs">
                                                {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                <span className="ml-2 text-indigo-500 font-medium">
                                                    {record.type === 'initial' ? '首次买入' : '补充买入'}
                                                </span>
                                            </div>
                                            <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                + {record.amount}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center text-slate-400 text-xs py-2">暂无已结算记录</div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex justify-between items-baseline">
                                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">总计买入</div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
                                        <span className="text-base text-slate-400">¥</span>
                                        {buyInRecords.reduce((sum, current) => sum + current.amount, 0)}
                                    </div>
                                </div>
                            </div>

                            {/* Lucky Hands Section */}
                            {luckyHandsCount > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                                            <span className="material-symbols-outlined text-[18px] text-yellow-500">playing_cards</span>
                                            幸运手牌战绩
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {Array.from({ length: luckyHandsCount }).map((_, idx) => {
                                            const handIndex = idx + 1;
                                            const data = luckyHands.find(h => h.hand_index === handIndex);

                                            return (
                                                <div key={handIndex} className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-colors relative
                                                   ${data ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-[#1f2e3d] border-dashed border-slate-200 dark:border-slate-700'}
                                               `}>
                                                    {/* Hit Badge */}
                                                    {data && data.hit_count > 0 && (
                                                        <div className="absolute -top-2 w-full flex justify-center">
                                                            <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[10px]">star</span>
                                                                ×{data.hit_count}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="text-xs text-slate-400 font-bold mb-1">槽位 {handIndex}</div>
                                                    {data ? (
                                                        <div className="flex flex-col items-center mt-1">
                                                            <div className="flex gap-1 justify-center">
                                                                <PokerCardDisp card={data.card_1} className="text-[13px] px-1 shadow-sm" />
                                                                <PokerCardDisp card={data.card_2} className="text-[13px] px-1 shadow-sm" />
                                                            </div>
                                                            {currentUserId === userId && onModifyLuckyHand && data.hit_count === 0 && (
                                                                <button
                                                                    onClick={() => onModifyLuckyHand(handIndex)}
                                                                    className="mt-2 text-[10px] text-indigo-500 hover:text-white hover:bg-indigo-500 font-bold bg-white dark:bg-[#192633] px-2 py-0.5 rounded shadow-sm border border-indigo-200 transition-colors"
                                                                >
                                                                    修改手牌
                                                                </button>
                                                            )}
                                                            {currentUserId === userId && data.hit_count > 0 && (
                                                                <div className="mt-2 text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 cursor-not-allowed text-center">
                                                                    已得分锁定
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-2xl text-slate-300 dark:text-slate-600 font-light">-</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
