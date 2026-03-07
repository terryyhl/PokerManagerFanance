import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ChipDenom {
    label: string;
    value: number;
    color: string; // tailwind bg
    textColor: string;
}

const CHIP_DENOMS: ChipDenom[] = [
    { label: '1', value: 1, color: 'bg-white border-2 border-slate-300', textColor: 'text-slate-700' },
    { label: '5', value: 5, color: 'bg-red-500', textColor: 'text-white' },
    { label: '10', value: 10, color: 'bg-blue-500', textColor: 'text-white' },
    { label: '25', value: 25, color: 'bg-green-500', textColor: 'text-white' },
    { label: '50', value: 50, color: 'bg-orange-500', textColor: 'text-white' },
    { label: '100', value: 100, color: 'bg-slate-900 dark:bg-slate-200', textColor: 'text-white dark:text-slate-900' },
    { label: '500', value: 500, color: 'bg-purple-500', textColor: 'text-white' },
    { label: '1000', value: 1000, color: 'bg-amber-400', textColor: 'text-amber-900' },
];

export default function ChipCalculator() {
    const navigate = useNavigate();
    const fromGame = (useLocation().state as { fromGame?: boolean } | null)?.fromGame === true;
    const [counts, setCounts] = useState<Record<number, number>>({});

    const handleChange = (value: number, count: string) => {
        const parsed = parseInt(count, 10);
        setCounts(prev => ({
            ...prev,
            [value]: isNaN(parsed) ? 0 : Math.max(0, parsed),
        }));
    };

    const handleIncrement = (value: number, delta: number) => {
        setCounts(prev => ({
            ...prev,
            [value]: Math.max(0, (prev[value] || 0) + delta),
        }));
    };

    const total = useMemo(() => {
        return CHIP_DENOMS.reduce((sum, d) => sum + d.value * (counts[d.value] || 0), 0);
    }, [counts]);

    const chipCount = useMemo(() => {
        return CHIP_DENOMS.reduce((sum, d) => sum + (counts[d.value] || 0), 0);
    }, [counts]);

    const handleReset = () => setCounts({});

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">筹码计算器</h1>
                <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400">
                    <span className="material-symbols-outlined text-[22px]">refresh</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-36">
                {/* 筹码面额列表 */}
                <div className="space-y-3">
                    {CHIP_DENOMS.map((denom) => {
                        const count = counts[denom.value] || 0;
                        const subtotal = denom.value * count;
                        return (
                            <div key={denom.value} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1a2632] border border-slate-100 dark:border-slate-800">
                                {/* 筹码图标 */}
                                <div className={`w-11 h-11 rounded-full ${denom.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
                                    <span className={`text-xs font-black ${denom.textColor}`}>{denom.label}</span>
                                </div>

                                {/* 面额标签 */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold">{denom.value} 积分</div>
                                    {count > 0 && (
                                        <div className="text-[11px] text-slate-400">小计: {subtotal}</div>
                                    )}
                                </div>

                                {/* 数量控制 */}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleIncrement(denom.value, -1)}
                                        disabled={count <= 0}
                                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-30"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">remove</span>
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        value={count || ''}
                                        onChange={e => handleChange(denom.value, e.target.value)}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                        placeholder="0"
                                        className="w-14 h-8 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111a22] text-sm font-bold focus:border-primary focus:outline-none"
                                    />
                                    <button
                                        onClick={() => handleIncrement(denom.value, 1)}
                                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 底部汇总 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#151f2b] border-t border-slate-200 dark:border-slate-800 px-5 py-4 z-30">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-400 font-medium">共 {chipCount} 枚筹码</div>
                        <div className="text-2xl font-black text-primary">{total.toLocaleString()} <span className="text-sm font-bold text-slate-400">积分</span></div>
                    </div>
                    {total > 0 && (
                        <button
                            onClick={handleReset}
                            className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm active:scale-95 transition-all"
                        >
                            清零
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
