import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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

// 判断当前路径是否属于 MainLayout 的三个 Tab
const MAIN_PATHS = ['/lobby', '/history', '/profile'];
const isMainPath = (p: string) => MAIN_PATHS.includes(p);

// 判断是否是公开路径（Welcome / Login）
const isPublicPath = (p: string) => p === '/' || p === '/login';

/**
 * AppShell
 * 架构设计：
 * - MainLayout（大厅 / 历史 / 个人）始终挂载，切换时用 visibility 隐藏，不销毁状态
 * - GameRoom / 结算等"二级页面"以绝对定位覆盖层方式渲染
 * - 返回到 Tab 页时，二级覆盖层销毁，但底层 MainLayout 状态完整保留
 */
function AppShell() {
  const location = useLocation();
  const pathname = location.pathname;
  const isPublic = isPublicPath(pathname);
  const isOverlay = !isMainPath(pathname) && !isPublic;

  return (
    <div className="w-full max-w-[430px] h-[100dvh] sm:h-[min(932px,100dvh)] sm:rounded-[2.5rem] sm:border-[8px] border-gray-800 dark:border-gray-950 bg-white dark:bg-background-dark overflow-hidden relative shadow-2xl">

      {/* 公开页（Welcome / Login） */}
      {isPublic && (
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      )}

      {/* 底层：MainLayout 始终保持挂载（Keep-Alive），通过 visibility 控制显示 */}
      {!isPublic && (
        <ProtectedRoute>
          <div
            className="absolute inset-0"
            style={{ visibility: isOverlay ? 'hidden' : 'visible' }}
          >
            <MainLayout />
          </div>
        </ProtectedRoute>
      )}

      {/* 覆盖层：占满全屏，在 MainLayout 之上渲染 */}
      {isOverlay && (
        <div className="absolute inset-0 z-10">
          <ProtectedRoute>
            <Routes>
              <Route path="/join" element={<JoinRoom />} />
              <Route path="/create" element={<CreateGame />} />
              <Route path="/game/:id" element={<GameRoom />} />
              <Route path="/bill/:id" element={<PersonalBill />} />
              <Route path="/settlement/:id" element={<SettlementReport />} />
            </Routes>
          </ProtectedRoute>
        </div>
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const cleanup = setupGlobalClickSound();
    return cleanup;
  }, []);

  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center">
        <Router>
          <AppShell />
        </Router>
      </div>
    </UserProvider>
  );
}
