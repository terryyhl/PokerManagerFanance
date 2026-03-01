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
        <div className={`relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 transition-all ${className} ${isAdmin ? 'ring-[3px] ring-amber-400 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark shadow-[0_0_20px_rgba(251,191,36,0.6)] z-10' : 'overflow-hidden rounded-full'}`}>
            <div className={`w-full h-full overflow-hidden rounded-full`}>
                <img src={avatarUrl} alt={`${username}'s avatar`} className="w-full h-full object-cover" />
            </div>

            {isAdmin && (
                <>
                    {/* Crown Badge */}
                    <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-700 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 z-20 scale-110">
                        <span className="text-xs leading-none filter drop-shadow-sm">👑</span>
                    </div>
                </>
            )}
        </div>
    );
}
