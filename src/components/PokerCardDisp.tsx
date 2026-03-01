import React from 'react';

interface PokerCardDispProps {
    card: string;
    className?: string;
}

export default function PokerCardDisp({ card, className = '' }: PokerCardDispProps) {
    if (!card) return null;

    // card 格式类似于 "A♠", "10♥" (假设带有花色符号)
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    const isRed = suit === '♥' || suit === '♦';

    return (
        <div className={`flex items-center justify-center gap-0.5 bg-white text-base font-black px-1.5 py-0.5 rounded border border-slate-300 shadow-sm ${isRed ? 'text-red-600' : 'text-slate-800'} ${className}`}>
            <span>{rank}</span>
            <span className="text-[0.9em]">{suit}</span>
        </div>
    );
}
