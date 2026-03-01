import React from 'react';

interface AvatarProps {
    username: string;
    className?: string;
    isAdmin?: boolean;
}

export default function Avatar({ username, className = '', isAdmin = false }: AvatarProps) {
    // Using DiceBear open source avatar library ('bottts' robots or 'adventurer' or 'notionists')
    // The 'seed' parameter ensures a deterministic avatar for the same username
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    return (
        <div className={`relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 transition-all ${className} ${isAdmin ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'overflow-hidden'}`}>
            <div className={`w-full h-full overflow-hidden ${isAdmin ? 'rounded-full' : ''}`}>
                <img src={avatarUrl} alt={`${username}'s avatar`} className="w-full h-full object-cover" />
            </div>

            {isAdmin && (
                <div className="absolute -top-1 -right-1 bg-gradient-to-br from-amber-300 to-amber-600 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-[0_2px_5px_rgba(0,0,0,0.3)] border border-white/50 z-10 animate-pulse">
                    <span className="text-[10px] leading-none">👑</span>
                </div>
            )}
        </div>
    );
}
