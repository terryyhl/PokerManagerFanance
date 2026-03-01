import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './components/ProtectedRoute';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import JoinRoom from './pages/JoinRoom';
import CreateGame from './pages/CreateGame';
import GameRoom from './pages/GameRoom';
import PersonalBill from './pages/PersonalBill';
import SettlementReport from './pages/SettlementReport';
import MainLayout from './components/MainLayout';
import { setupGlobalClickSound } from './lib/audio';

export default function App() {
  useEffect(() => {
    // Enable global click sound effects
    const cleanup = setupGlobalClickSound();
    return cleanup;
  }, []);

  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center">
        <div className="w-full max-w-[430px] h-[100dvh] sm:h-[min(932px,100dvh)] sm:rounded-[2.5rem] sm:border-[8px] border-gray-800 dark:border-gray-950 bg-white dark:bg-background-dark overflow-hidden relative shadow-2xl">
          <Router>
            <Routes>
              {/* 公开路由：无需登录 */}
              <Route path="/" element={<Welcome />} />
              <Route path="/login" element={<Login />} />

              {/* 持久化布局路由：包含大厅、历史、个人中心 */}
              <Route path="/lobby" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><MainLayout /></ProtectedRoute>} />

              {/* 其他独立路由 */}
              <Route path="/join" element={<ProtectedRoute><JoinRoom /></ProtectedRoute>} />
              <Route path="/create" element={<ProtectedRoute><CreateGame /></ProtectedRoute>} />
              <Route path="/game/:id" element={<ProtectedRoute><GameRoom /></ProtectedRoute>} />
              <Route path="/bill/:id" element={<ProtectedRoute><PersonalBill /></ProtectedRoute>} />
              <Route path="/settlement/:id" element={<ProtectedRoute><SettlementReport /></ProtectedRoute>} />
            </Routes>
          </Router>
        </div>
      </div>
    </UserProvider>
  );
}
