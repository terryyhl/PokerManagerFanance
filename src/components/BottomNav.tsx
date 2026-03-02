import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { id: 'lobby', path: '/lobby', icon: 'playing_cards', label: '大厅' },
        { id: 'clock', path: '/clock', icon: 'timer', label: '时钟' },
        { id: 'coin', path: '/coin', icon: 'monetization_on', label: '硬币' },
        { id: 'profile', path: '/profile', icon: 'person', label: '个人' }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#151f2b] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-50 pb-safe">
            {tabs.map((tab) => {
                const isActive = location.pathname.startsWith(tab.path);
                return (
                    <button
                        key={tab.id}
                        onClick={() => navigate(tab.path)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive
                            ? 'text-primary'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        <span
                            className={`material-symbols-outlined text-[24px] transition-all ${isActive ? 'font-variation-fill-1' : ''
                                }`}
                            style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                        >
                            {tab.icon}
                        </span>
                        <span className={`text-[10px] font-bold ${isActive ? 'scale-105' : ''}`}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
