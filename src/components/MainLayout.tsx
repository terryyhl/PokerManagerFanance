import React from 'react';
import { useLocation } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import GameHistory from '../pages/GameHistory';
import Profile from '../pages/Profile';
import Toolbox from '../pages/Toolbox';
import BottomNav from './BottomNav';

export default function MainLayout() {
    const location = useLocation();
    const pathname = location.pathname;

    const isLobby = pathname === '/lobby';
    const isHistory = pathname === '/history';
    const isTools = pathname === '/tools';
    const isProfile = pathname === '/profile';

    return (
        <div className="relative h-full w-full flex flex-col">
            <div className={`flex-1 min-h-0 ${!isLobby ? 'hidden' : ''}`}>
                <Lobby />
            </div>

            <div className={`flex-1 min-h-0 ${!isHistory ? 'hidden' : ''}`}>
                <GameHistory />
            </div>

            <div className={`flex-1 min-h-0 ${!isTools ? 'hidden' : ''}`}>
                <Toolbox />
            </div>

            <div className={`flex-1 min-h-0 ${!isProfile ? 'hidden' : ''}`}>
                <Profile />
            </div>

            <BottomNav />
        </div>
    );
}
