import React, { useState, useEffect, useRef } from 'react';

const SUITS = [
    { symbol: '♠', color: 'text-slate-900 dark:text-slate-100', name: 's' },
    { symbol: '♥', color: 'text-red-500', name: 'h' },
    { symbol: '♣', color: 'text-slate-900 dark:text-slate-100', name: 'c' },
    { symbol: '♦', color: 'text-red-500', name: 'd' }
];

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

interface CardSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (card1: string, card2: string) => void;
    targetHandIndex: number; // 当前正在给几号位选牌
}

export default function CardSelectorModal({ isOpen, onClose, onConfirm, targetHandIndex }: CardSelectorModalProps) {
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const autoConfirmTimer = useRef<NodeJS.Timeout | null>(null);

    // 选中 2 张后自动确认（短延迟让用户看到选中效果）
    useEffect(() => {
        if (selectedCards.length === 2) {
            autoConfirmTimer.current = setTimeout(() => {
                onConfirm(selectedCards[0], selectedCards[1]);
                setSelectedCards([]);
            }, 350);
        }
        return () => {
            if (autoConfirmTimer.current) clearTimeout(autoConfirmTimer.current);
        };
    }, [selectedCards, onConfirm]);

    if (!isOpen) return null;

    const handleCardClick = (card: string) => {
        if (selectedCards.includes(card)) {
            setSelectedCards(prev => prev.filter(c => c !== card));
        } else {
            if (selectedCards.length < 2) {
                setSelectedCards(prev => [...prev, card]);
            } else {
                // 如果已经选了两张，替换最后一张
                setSelectedCards(prev => [prev[0], card]);
            }
        }
    };

    const handleConfirm = () => {
        if (selectedCards.length === 2) {
            onConfirm(selectedCards[0], selectedCards[1]);
            setSelectedCards([]); // reset
        }
    };

    const handleClose = () => {
        setSelectedCards([]);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md bg-white dark:bg-[#192633] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-[#192633] z-10">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">配置手牌 #{targetHandIndex}</h3>
                        <p className="text-xs text-slate-500 mt-1">请选择刚好 2 张牌进行组合</p>
                    </div>
                    <button
                        onClick={handleClose}
                        aria-label="关闭"
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* 已选展示区 */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-center gap-4">
                    {[0, 1].map(idx => {
                        const card = selectedCards[idx];
                        return (
                            <div key={idx} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-xl font-bold bg-white dark:bg-slate-800 shadow-sm
                    ${card ? 'border-primary ring-2 ring-primary/20' : 'border-dashed border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600'}
                   `}>
                                {card ? (
                                    <span className={card.includes('♥') || card.includes('♦') ? 'text-red-500' : 'text-slate-900 dark:text-white'}>
                                        {card}
                                    </span>
                                ) : '?'}
                            </div>
                        );
                    })}
                </div>

                {/* 选牌区 */}
                <div className="p-4 overflow-y-auto">
                    <div className="flex flex-col gap-4 pb-4">
                        {SUITS.map(suit => (
                            <div key={suit.name} className="flex flex-nowrap overflow-x-auto gap-2 pb-2 no-scrollbar">
                                <div className={`flex-shrink-0 w-8 flex items-center justify-center text-2xl ${suit.color}`}>
                                    {suit.symbol}
                                </div>
                                {RANKS.map(rank => {
                                    const cardValue = `${rank}${suit.symbol}`;
                                    const isSelected = selectedCards.includes(cardValue);
                                    return (
                                        <button
                                            key={rank}
                                            onClick={() => handleCardClick(cardValue)}
                                            className={`flex-shrink-0 w-12 h-16 rounded-lg text-lg font-bold flex flex-col items-center justify-center transition-all ${isSelected
                                                ? 'bg-primary text-white scale-105 shadow-md shadow-primary/30'
                                                : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                                                }`}
                                        >
                                            <span className={isSelected ? 'text-white' : suit.color}>{suit.symbol}</span>
                                            <span>{rank}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 底部提示 */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#192633] sticky bottom-0 z-10 w-full">
                    <div className={`w-full h-12 rounded-xl flex items-center justify-center font-bold transition-all ${selectedCards.length === 2 ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                        {selectedCards.length === 2 ? (
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                自动确认中...
                            </span>
                        ) : (
                            <span>选择 2 张牌后自动确认（已选 {selectedCards.length}/2）</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
