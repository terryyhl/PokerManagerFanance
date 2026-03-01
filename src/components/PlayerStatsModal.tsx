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
}

export default function PlayerStatsModal({
    isOpen,
    onClose,
    gameId,
    userId,
    username,
    luckyHandsCount
}: PlayerStatsModalProps) {
    const [totalBuyin, setTotalBuyin] = useState(0);
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
                    .select('amount, type')
                    .eq('game_id', gameId)
                    .eq('user_id', userId);

                if (!buyinError && buyinData) {
                    const total = buyinData
                        .filter(b => b.type !== 'checkout')
                        .reduce((sum, current) => sum + current.amount, 0);
                    if (isMounted) setTotalBuyin(total);
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

                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/30 mb-3 border-4 border-white dark:border-[#192633]">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{username}</h2>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full mt-1">
                        玩家数据中心
                    </span>
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
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">本局总买入</div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
                                    <span className="text-lg text-slate-400">¥</span>
                                    {totalBuyin}
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
                                                        <div className="flex gap-1 justify-center mt-1">
                                                            <PokerCardDisp card={data.card_1} className="text-[13px] px-1 shadow-sm" />
                                                            <PokerCardDisp card={data.card_2} className="text-[13px] px-1 shadow-sm" />
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
