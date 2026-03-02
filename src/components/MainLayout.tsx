import React from 'react';
import { useLocation } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import Profile from '../pages/Profile';
import GameClock from '../pages/GameClock';
import BottomNav from './BottomNav';

export default function MainLayout() {
    const location = useLocation();
    const pathname = location.pathname;

    const isLobby = pathname === '/lobby';
    const isClock = pathname === '/clock';
    const isProfile = pathname === '/profile';

    return (
        <div className="relative h-full w-full flex flex-col">
            <div className={`flex-1 min-h-0 ${!isLobby ? 'hidden' : ''}`}>
                <Lobby />
            </div>

            <div className={`flex-1 min-h-0 ${!isClock ? 'hidden' : ''}`}>
                <GameClock />
            </div>

            <div className={`flex-1 min-h-0 ${!isProfile ? 'hidden' : ''}`}>
                <Profile />
            </div>

            <BottomNav />
        </div>
    );
}
