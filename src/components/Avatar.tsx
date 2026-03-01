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
        <div className={`relative overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
            <img src={avatarUrl} alt={`${username}'s avatar`} className="w-full h-full object-cover" />

            {isAdmin && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white rounded-bl-lg p-0.5 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[12px] font-bold">crown</span>
                </div>
            )}
        </div>
    );
}
