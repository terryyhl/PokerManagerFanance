import React from 'react';

interface AvatarProps {
    username: string;
    className?: string;
}

export default function Avatar({ username, className = '' }: AvatarProps) {
    // Using DiceBear open source avatar library ('bottts' robots or 'adventurer' or 'notionists')
    // The 'seed' parameter ensures a deterministic avatar for the same username
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

    return (
        <div className={`overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
            <img src={avatarUrl} alt={`${username}'s avatar`} className="w-full h-full object-cover" />
        </div>
    );
}
