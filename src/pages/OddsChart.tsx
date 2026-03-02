import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Category = 'premium' | 'strong' | 'speculative' | 'outs';

interface HandOdds {
    hand: string;
    vsRandom: string; // 对随机手牌的胜率
    note: string;
}

const PREMIUM_HANDS: HandOdds[] = [
    { hand: 'AA', vsRandom: '85%', note: '火箭，翻前最强' },
    { hand: 'KK', vsRandom: '82%', note: '牛仔，仅惧AA' },
    { hand: 'QQ', vsRandom: '80%', note: '女士，翻前第三' },
    { hand: 'JJ', vsRandom: '77%', note: '鱼钩，常被高估' },
    { hand: 'AKs', vsRandom: '67%', note: '大光头同花，画牌之王' },
    { hand: 'AKo', vsRandom: '65%', note: '大光头杂花' },
];

const STRONG_HANDS: HandOdds[] = [
    { hand: 'TT', vsRandom: '75%', note: '中等口袋对' },
    { hand: '99', vsRandom: '72%', note: '暗三价值高' },
    { hand: 'AQs', vsRandom: '66%', note: '同花大嫂' },
    { hand: 'AJs', vsRandom: '65%', note: '同花AJ' },
    { hand: 'KQs', vsRandom: '63%', note: '同花国王皇后' },
    { hand: '88', vsRandom: '69%', note: '雪人，set mining好牌' },
    { hand: 'ATs', vsRandom: '64%', note: '同花AT' },
    { hand: 'AQo', vsRandom: '64%', note: '杂花大嫂' },
];

const SPECULATIVE_HANDS: HandOdds[] = [
    { hand: '77-22', vsRandom: '66~50%', note: '小对子，追暗三' },
    { hand: 'JTs', vsRandom: '57%', note: '最好的连张同花' },
    { hand: 'T9s', vsRandom: '54%', note: '同花连张，多面听牌' },
    { hand: '98s', vsRandom: '53%', note: '同花连张' },
    { hand: '87s', vsRandom: '52%', note: '同花连张' },
    { hand: 'A5s-A2s', vsRandom: '55~53%', note: '小同花A，坚果同花抽' },
    { hand: 'KJs', vsRandom: '61%', note: '同花KJ，不算边缘' },
    { hand: 'QJs', vsRandom: '59%', note: '同花QJ' },
];

interface OutsInfo {
    draw: string;
    outs: number;
    turnPct: string;
    riverPct: string;
    twoCardPct: string;
}

const OUTS_DATA: OutsInfo[] = [
    { draw: '后门同花听牌', outs: 1, turnPct: '2%', riverPct: '2%', twoCardPct: '4%' },
    { draw: '口袋对 → 暗三', outs: 2, turnPct: '4%', riverPct: '4%', twoCardPct: '8%' },
    { draw: '一头顺子听牌 (卡顺)', outs: 4, turnPct: '9%', riverPct: '9%', twoCardPct: '17%' },
    { draw: '两头顺子听牌', outs: 8, turnPct: '17%', riverPct: '17%', twoCardPct: '32%' },
    { draw: '同花听牌', outs: 9, turnPct: '19%', riverPct: '19%', twoCardPct: '35%' },
    { draw: '同花 + 卡顺', outs: 12, turnPct: '26%', riverPct: '26%', twoCardPct: '45%' },
    { draw: '同花 + 两头顺', outs: 15, turnPct: '33%', riverPct: '33%', twoCardPct: '54%' },
];

const CATEGORIES: { key: Category; label: string; icon: string; color: string }[] = [
    { key: 'premium', label: '顶级', icon: 'star', color: 'text-amber-500' },
    { key: 'strong', label: '强牌', icon: 'thumb_up', color: 'text-blue-500' },
    { key: 'speculative', label: '投机', icon: 'casino', color: 'text-emerald-500' },
    { key: 'outs', label: 'Outs', icon: 'calculate', color: 'text-rose-500' },
];

export default function OddsChart() {
    const navigate = useNavigate();
    const [category, setCategory] = useState<Category>('premium');

    const currentHands = category === 'premium' ? PREMIUM_HANDS
        : category === 'strong' ? STRONG_HANDS
            : SPECULATIVE_HANDS;

    return (
        <div className="relative flex h-full w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-slate-200 dark:border-slate-800">
                <button onClick={() => navigate('/tools')} className="mr-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold flex-1">概率速查</h1>
                <span className="material-symbols-outlined text-[24px] text-indigo-500" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            </div>

            {/* 分类标签 */}
            <div className="flex-shrink-0 flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setCategory(cat.key)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            category === cat.key
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-[14px] ${category === cat.key ? 'text-white' : cat.color}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                            {cat.icon}
                        </span>
                        {cat.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {category !== 'outs' ? (
                    <>
                        <div className="text-xs text-slate-400 font-medium mb-3 mt-1">
                            {category === 'premium' ? '翻前最强手牌，几乎所有位置都可以加注' :
                                category === 'strong' ? '强力手牌，大多数位置可开局' :
                                    '需要好位置和深筹码，追求高隐含赔率'}
                        </div>
                        <div className="space-y-2.5">
                            {currentHands.map(h => (
                                <div key={h.hand} className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-[#1a2632] border border-slate-100 dark:border-slate-800">
                                    <div className="w-14 h-10 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-sm font-black tracking-tight">{h.hand}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-slate-400 leading-tight">{h.note}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-lg font-black text-primary">{h.vsRandom}</div>
                                        <div className="text-[10px] text-slate-400">vs 随机</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-xs text-slate-400 font-medium mb-3 mt-1">
                            Outs 数量 → 中牌概率（2/4 法则速算）
                        </div>
                        <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                            {/* 表头 */}
                            <div className="flex items-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-[#15202b]">
                                <span className="flex-1">听牌类型</span>
                                <span className="w-12 text-center">Outs</span>
                                <span className="w-14 text-center">翻→转</span>
                                <span className="w-14 text-center">转→河</span>
                                <span className="w-14 text-center">翻→河</span>
                            </div>
                            {OUTS_DATA.map((d, idx) => (
                                <div key={idx} className={`flex items-center px-4 py-3 text-sm ${idx < OUTS_DATA.length - 1 ? 'border-b border-slate-100 dark:border-slate-700/30' : ''}`}>
                                    <span className="flex-1 text-xs font-medium pr-2">{d.draw}</span>
                                    <span className="w-12 text-center font-black text-primary">{d.outs}</span>
                                    <span className="w-14 text-center text-xs font-bold text-slate-500">{d.turnPct}</span>
                                    <span className="w-14 text-center text-xs font-bold text-slate-500">{d.riverPct}</span>
                                    <span className="w-14 text-center text-xs font-bold text-emerald-500">{d.twoCardPct}</span>
                                </div>
                            ))}
                        </div>

                        {/* 2/4法则 */}
                        <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-indigo-500 text-[18px]">lightbulb</span>
                                <span className="text-sm font-bold text-indigo-500">2/4 法则速算</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                <b>翻牌后</b>（还有两张公共牌）：Outs x <b>4</b> = 大约中牌概率<br />
                                <b>转牌后</b>（还有一张公共牌）：Outs x <b>2</b> = 大约中牌概率<br />
                                例如：9 个同花 Outs，翻牌后 9x4 = 36% ≈ 实际 35%
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
