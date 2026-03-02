import React from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/AnimatedPage';

interface Tool {
    id: string;
    path: string;
    icon: string;
    label: string;
    desc: string;
    color: string; // tailwind bg gradient
    iconBg: string;
}

const TOOLS: Tool[] = [
    {
        id: 'clock',
        path: '/tools/clock',
        icon: 'timer',
        label: '牌局时钟',
        desc: '倒计时提醒，到时间换位',
        color: 'from-blue-500 to-cyan-500',
        iconBg: 'bg-blue-500/15 text-blue-500',
    },
    {
        id: 'coin',
        path: '/tools/coin',
        icon: 'monetization_on',
        label: '掷硬币',
        desc: '正反面随机决策',
        color: 'from-amber-500 to-yellow-500',
        iconBg: 'bg-amber-500/15 text-amber-500',
    },
    {
        id: 'seat',
        path: '/tools/seat',
        icon: 'event_seat',
        label: '座位分配',
        desc: '随机分配玩家座位号',
        color: 'from-emerald-500 to-teal-500',
        iconBg: 'bg-emerald-500/15 text-emerald-500',
    },
    {
        id: 'picker',
        path: '/tools/picker',
        icon: 'person_pin_circle',
        label: '抽选庄家',
        desc: '随机选一人当庄家',
        color: 'from-purple-500 to-violet-500',
        iconBg: 'bg-purple-500/15 text-purple-500',
    },
    {
        id: 'chips',
        path: '/tools/chips',
        icon: 'calculate',
        label: '筹码计算器',
        desc: '快速换算筹码总额',
        color: 'from-rose-500 to-pink-500',
        iconBg: 'bg-rose-500/15 text-rose-500',
    },
    {
        id: 'odds',
        path: '/tools/odds',
        icon: 'analytics',
        label: '概率速查',
        desc: '常见手牌翻前胜率',
        color: 'from-indigo-500 to-blue-500',
        iconBg: 'bg-indigo-500/15 text-indigo-500',
    },
    {
        id: 'dice',
        path: '/tools/dice',
        icon: 'casino',
        label: '掷骰子',
        desc: '1~3个骰子随机投掷',
        color: 'from-orange-500 to-red-500',
        iconBg: 'bg-orange-500/15 text-orange-500',
    },
];

export default function Toolbox() {
    const navigate = useNavigate();

    return (
        <AnimatedPage animationType="slide-left">
            <div className="relative flex h-full min-h-full w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
                <div className="flex-shrink-0 flex items-center justify-center p-5 pt-8">
                    <h2 className="text-2xl font-bold leading-tight tracking-[-0.015em]">工具箱</h2>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-24">
                    <div className="grid grid-cols-2 gap-3">
                        {TOOLS.map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => navigate(tool.path)}
                                className="flex flex-col items-start p-4 rounded-2xl bg-white dark:bg-[#1a2632] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-[0.97] text-left"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${tool.iconBg}`}>
                                    <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {tool.icon}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">{tool.label}</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">{tool.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </AnimatedPage>
    );
}
