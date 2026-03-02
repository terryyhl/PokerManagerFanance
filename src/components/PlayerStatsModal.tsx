import React, { useEffect, useState } from 'react';
import { playerStatsApi, PlayerBuyInRecord, luckyHandsApi, LuckyHand } from '../lib/api';
import { LuckyHandData } from './LuckyHandFAB';
import Avatar from './Avatar';
import HandComboDisp from './HandComboDisp';

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
    const [buyInRecords, setBuyInRecords] = useState<PlayerBuyInRecord[]>([]);
    const [checkoutRecord, setCheckoutRecord] = useState<{ amount: number; created_at: string } | null>(null);
    const [luckyHands, setLuckyHands] = useState<LuckyHandData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!isOpen || !gameId || !userId) return;

        let isMounted = true;
        const fetchStats = async () => {
            setIsLoading(true);
            setError(false);
            try {
                // #19: 通过 API 层获取数据，而非直接查询 Supabase
                const { buyIns: buyinData } = await playerStatsApi.getBuyIns(gameId, userId);

                if (isMounted) {
                    setBuyInRecords(buyinData.filter(b => b.type !== 'checkout'));
                    const checkout = buyinData.find(b => b.type === 'checkout');
                    setCheckoutRecord(checkout ? { amount: checkout.amount, created_at: checkout.created_at } : null);
                }

                // Fetch lucky hands via API
                if (luckyHandsCount > 0) {
                    const { luckyHands: allHands } = await luckyHandsApi.getAll(gameId);
                    if (isMounted) {
                        const playerHands = allHands
                            .filter((h: LuckyHand) => h.user_id === userId)
                            .map((h: LuckyHand) => ({
                                hand_index: h.hand_index,
                                card_1: h.card_1,
                                card_2: h.card_2,
                                hit_count: h.hit_count,
                            }));
                        setLuckyHands(playerHands);
                    }
                }
            } catch (err) {
                console.error('Fetch player stats error:', err);
                if (isMounted) setError(true);
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
            <div className="w-full max-w-sm bg-white dark:bg-[#192633] rounded-2xl shadow-2xl overflow-visible flex flex-col relative z-10 box-border text-slate-800 dark:text-slate-200 transform scale-100 transition-all mt-7">

                {/* Avatar - half outside modal */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-14 h-14 shadow-xl ring-4 ring-white dark:ring-[#192633] rounded-full bg-white">
                        <Avatar username={username} className="w-full h-full" />
                    </div>
                </div>

                {/* Header */}
                <div className="relative pt-10 pb-2 px-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-900/40 dark:to-purple-900/40 flex flex-col items-center border-b border-indigo-100 dark:border-indigo-900/50 rounded-t-2xl">
                    <button
                        onClick={onClose}
                        aria-label="关闭"
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{username}</h2>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <span className="material-symbols-outlined animate-spin text-primary text-3xl">rotate_right</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center py-8 text-center text-slate-400 text-sm gap-2">
                            <span className="material-symbols-outlined text-3xl">error_outline</span>
                            加载失败，请关闭后重试
                        </div>
                    ) : (
                        <>
                            {/* Finances - Timeline */}
                            <div className="bg-slate-50 dark:bg-[#1f2e3d] rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                    买入记录流水
                                </div>

                                {buyInRecords.length > 0 ? (
                                    <div className="relative max-h-48 overflow-y-auto no-scrollbar">
                                        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />
                                        <div className="space-y-3">
                                            {buyInRecords.map((record, i) => {
                                                const isInitial = record.type === 'initial';
                                                let runningTotal = 0;
                                                for (let j = 0; j <= i; j++) runningTotal += buyInRecords[j].amount;
                                                return (
                                                    <div key={i} className="flex items-start gap-3 relative">
                                                        <div className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${isInitial ? 'bg-primary' : 'bg-indigo-400 dark:bg-indigo-500'}`}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isInitial ? 'bg-primary/10 text-primary' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                                        {isInitial ? '首次买入' : '补充买入'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-200">+{record.amount}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                累计: {runningTotal}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {checkoutRecord && (
                                                <div className="flex items-start gap-3 relative">
                                                    <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500">
                                                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">结账离场</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {new Date(checkoutRecord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{checkoutRecord.amount}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 text-xs py-4">暂无买入记录</div>
                                )}

                                {buyInRecords.length > 0 && (
                                    <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-baseline justify-between">
                                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">总买入</div>
                                        <div className="flex items-baseline gap-3">
                                            {checkoutRecord && (
                                                <div className="text-xs text-slate-400">
                                                    结账 <span className="font-bold text-emerald-500">{checkoutRecord.amount}</span>
                                                </div>
                                            )}
                                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                                {buyInRecords.reduce((sum, r) => sum + r.amount, 0)}
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                                                x{data.hit_count}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="text-xs text-slate-400 font-bold mb-1">槽位 {handIndex}</div>
                                                    {data ? (
                                                        <div className="flex flex-col items-center mt-1">
                                                            <HandComboDisp combo={data.card_1} card2={data.card_2} compact />
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
                                                        <div className="flex flex-col items-center gap-1 py-1">
                                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[20px]">playing_cards</span>
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">未配置</span>
                                                        </div>
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
