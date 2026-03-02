import React, { useState, useEffect, useRef } from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

interface CardSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 返回组合字符串，如 'AKs', 'AKo', 'AAo'。card2 始终为空字符串 */
    onConfirm: (combo: string, card2: string) => void;
    targetHandIndex: number;
}

export default function CardSelectorModal({ isOpen, onClose, onConfirm, targetHandIndex }: CardSelectorModalProps) {
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [suited, setSuited] = useState(true);
    const autoConfirmTimer = useRef<NodeJS.Timeout | null>(null);

    const isPair = selectedRanks.length === 2 && selectedRanks[0] === selectedRanks[1];
    const isReady = selectedRanks.length === 2;

    // 选中 2 个点数后自动确认
    useEffect(() => {
        if (isReady) {
            autoConfirmTimer.current = setTimeout(() => {
                const [r1, r2] = selectedRanks;
                const sameRank = r1 === r2;
                const suffix = sameRank ? 'o' : (suited ? 's' : 'o');
                const combo = `${r1}${r2}${suffix}`;
                onConfirm(combo, '');
                setSelectedRanks([]);
                setSuited(true);
            }, 400);
        }
        return () => {
            if (autoConfirmTimer.current) clearTimeout(autoConfirmTimer.current);
        };
    }, [selectedRanks, suited, isReady, onConfirm]);

    if (!isOpen) return null;

    const handleRankClick = (rank: string) => {
        // 取消自动确认（如果用户点太快改选）
        if (autoConfirmTimer.current) clearTimeout(autoConfirmTimer.current);

        if (selectedRanks.length === 0) {
            setSelectedRanks([rank]);
        } else if (selectedRanks.length === 1) {
            setSelectedRanks([selectedRanks[0], rank]);
        } else {
            // 已选2个，重新开始
            setSelectedRanks([rank]);
        }
    };

    const handleClose = () => {
        setSelectedRanks([]);
        setSuited(true);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md bg-white dark:bg-[#192633] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#192633] z-10">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">配置手牌 #{targetHandIndex}</h3>
                        <p className="text-xs text-slate-500 mt-1">选择两个点数组成起手牌组合</p>
                    </div>
                    <button
                        onClick={handleClose}
                        aria-label="关闭"
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* 预览区 */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center gap-3">
                    <div className="flex items-center gap-2">
                        {[0, 1].map(idx => {
                            const rank = selectedRanks[idx];
                            return (
                                <div
                                    key={idx}
                                    className={`w-14 h-18 rounded-xl border-2 flex items-center justify-center text-2xl font-black bg-white dark:bg-slate-800 shadow-sm transition-all
                                        ${rank ? 'border-primary ring-2 ring-primary/20 text-slate-900 dark:text-white' : 'border-dashed border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600'}
                                    `}
                                    style={{ height: '4.5rem' }}
                                >
                                    {rank || '?'}
                                </div>
                            );
                        })}
                    </div>

                    {/* Suited / Offsuit 开关 */}
                    {selectedRanks.length >= 1 && !isPair && (
                        <div className="flex flex-col items-center gap-1.5 ml-2">
                            <button
                                onClick={() => {
                                    if (autoConfirmTimer.current) clearTimeout(autoConfirmTimer.current);
                                    setSuited(true);
                                    // 如果已经选了2个，重新触发自动确认
                                    if (selectedRanks.length === 2) {
                                        setSelectedRanks([...selectedRanks]);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${suited
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                            >
                                同花 s
                            </button>
                            <button
                                onClick={() => {
                                    if (autoConfirmTimer.current) clearTimeout(autoConfirmTimer.current);
                                    setSuited(false);
                                    if (selectedRanks.length === 2) {
                                        setSelectedRanks([...selectedRanks]);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!suited
                                    ? 'bg-slate-600 text-white shadow-md shadow-slate-600/30'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                            >
                                杂色 o
                            </button>
                        </div>
                    )}

                    {/* 对子提示 */}
                    {isPair && (
                        <div className="ml-2 px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                            口袋对
                        </div>
                    )}
                </div>

                {/* 点数选择区 */}
                <div className="p-4 overflow-y-auto">
                    <div className="grid grid-cols-5 gap-2 pb-2">
                        {RANKS.map(rank => {
                            const isFirst = selectedRanks[0] === rank && selectedRanks.length >= 1;
                            const isSecond = selectedRanks[1] === rank && selectedRanks.length === 2;
                            const isSelected = isFirst || isSecond;
                            return (
                                <button
                                    key={rank}
                                    onClick={() => handleRankClick(rank)}
                                    className={`h-14 rounded-xl text-xl font-black flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-primary text-white scale-105 shadow-md shadow-primary/30 ring-2 ring-primary/50'
                                        : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50 active:scale-95'
                                        }`}
                                >
                                    {rank}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 底部状态 */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#192633] sticky bottom-0 z-10 w-full">
                    <div className={`w-full h-12 rounded-xl flex items-center justify-center font-bold transition-all ${isReady ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                        {isReady ? (
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                {selectedRanks[0]}{selectedRanks[1]}{isPair ? '' : (suited ? 's' : 'o')} 确认中...
                            </span>
                        ) : (
                            <span>
                                {selectedRanks.length === 0 ? '请选择第一张牌的点数' : '请选择第二张牌的点数'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
