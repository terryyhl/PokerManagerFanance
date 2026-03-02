import React from 'react';
import { useLocation } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import Profile from '../pages/Profile';
import BottomNav from './BottomNav';

export default function MainLayout() {
    const location = useLocation();
    const pathname = location.pathname;

    const isLobby = pathname === '/lobby';
    const isProfile = pathname === '/profile';

    return (
        <div className="relative h-full w-full flex flex-col overflow-hidden">
            <div className={`flex-1 overflow-hidden ${!isLobby ? 'hidden' : ''}`}>
                <Lobby />
            </div>

            <div className={`flex-1 overflow-hidden ${!isProfile ? 'hidden' : ''}`}>
                <Profile />
            </div>

            <BottomNav />
        </div>
    );
}
