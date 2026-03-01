import React from 'react';
import { useLocation } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import GameHistory from '../pages/GameHistory';
import Profile from '../pages/Profile';
import BottomNav from './BottomNav';

export default function MainLayout() {
    const location = useLocation();
    const pathname = location.pathname;

    // Define which paths are part of the persistent tab system
    const isLobby = pathname === '/lobby';
    const isHistory = pathname === '/history';
    const isProfile = pathname === '/profile';

    return (
        <div className="relative h-full w-full flex flex-col overflow-hidden">
            {/* 
          Keep-alive implementation:
          All three pages are rendered, but only the active one is visible.
          This preserves local state, scroll positions, and network connections (SSE).
      */}
            <div className={`flex-1 overflow-hidden ${!isLobby ? 'hidden' : ''}`}>
                <Lobby />
            </div>

            <div className={`flex-1 overflow-hidden ${!isHistory ? 'hidden' : ''}`}>
                <GameHistory />
            </div>

            <div className={`flex-1 overflow-hidden ${!isProfile ? 'hidden' : ''}`}>
                <Profile />
            </div>

            <BottomNav />
        </div>
    );
}
