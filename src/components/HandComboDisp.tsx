import React from 'react';

interface HandComboDispProps {
    /** 组合字符串，如 'AKs', 'AKo', 'AAo', 或兼容旧格式 card_1+card_2 */
    combo: string;
    /** 旧格式兼容: 如果传了 card2，则走旧模式解析 */
    card2?: string;
    className?: string;
    /** 紧凑模式：不显示 suited/offsuit 标签 */
    compact?: boolean;
}

/**
 * 解析组合字符串，返回 { rank1, rank2, suited }
 * 支持新格式 "AKs"/"AKo" 和旧格式 card_1="A♠" card_2="K♥"
 */
export function parseCombo(combo: string, card2?: string): { rank1: string; rank2: string; suited: boolean } {
    // 旧格式兼容: card_1 含花色符号 (♠♥♣♦)
    if (card2 !== undefined && card2 !== '') {
        const r1 = combo.replace(/[♠♥♣♦]/g, '');
        const r2 = card2.replace(/[♠♥♣♦]/g, '');
        const s1 = combo.match(/[♠♥♣♦]/)?.[0];
        const s2 = card2.match(/[♠♥♣♦]/)?.[0];
        return { rank1: r1, rank2: r2, suited: s1 === s2 };
    }

    // 新格式: "AKs", "AKo", "TTo", "T9s" 等
    // 最后一个字符是 s/o，前面是两个点数
    if (combo.length >= 3 && (combo.endsWith('s') || combo.endsWith('o'))) {
        const suited = combo.endsWith('s');
        const ranks = combo.slice(0, -1);
        // 处理 '10' 形式 (虽然一般用T)
        if (ranks.length === 2) {
            return { rank1: ranks[0], rank2: ranks[1], suited };
        }
        // 如果有10的情况
        if (ranks.length === 3) {
            if (ranks.startsWith('10')) return { rank1: '10', rank2: ranks[2], suited };
            if (ranks.endsWith('10')) return { rank1: ranks[0], rank2: '10', suited };
        }
        if (ranks.length === 4 && ranks === '1010') return { rank1: '10', rank2: '10', suited: false };
    }

    // 兜底：单张旧格式含花色
    if (/[♠♥♣♦]/.test(combo)) {
        const r = combo.replace(/[♠♥♣♦]/g, '');
        return { rank1: r, rank2: '?', suited: false };
    }

    return { rank1: '?', rank2: '?', suited: false };
}

/**
 * 根据 combo 字符串生成展示用的完整标签，如 "AKs" => "AK 同花"
 */
export function comboLabel(combo: string, card2?: string): string {
    const { rank1, rank2, suited } = parseCombo(combo, card2);
    if (rank1 === rank2) return `${rank1}${rank2}`;
    return `${rank1}${rank2}${suited ? 's' : 'o'}`;
}

export default function HandComboDisp({ combo, card2, className = '', compact = false }: HandComboDispProps) {
    const { rank1, rank2, suited } = parseCombo(combo, card2);
    const isPair = rank1 === rank2;

    return (
        <div className={`inline-flex items-center gap-1 ${className}`}>
            {/* 两个点数牌面 */}
            <div className="flex items-center gap-0.5">
                <span className="inline-flex items-center justify-center bg-white text-slate-800 font-black px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-base leading-none">
                    {rank1}
                </span>
                <span className="inline-flex items-center justify-center bg-white text-slate-800 font-black px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-base leading-none">
                    {rank2}
                </span>
            </div>
            {/* suited/offsuit 标签 */}
            {!compact && !isPair && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${suited
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                    {suited ? '同花' : '杂色'}
                </span>
            )}
        </div>
    );
}
