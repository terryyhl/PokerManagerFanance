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
import LuckyHandHistory from './pages/LuckyHandHistory';
import MainLayout from './components/MainLayout';
import { setupGlobalClickSound } from './lib/audio';

// ─── 路径判断工具 ─────────────────────────────────────────────────────────────
const MAIN_PATHS = ['/lobby', '/profile'];
const isMainPath = (p: string) => MAIN_PATHS.includes(p);
const isPublicPath = (p: string) => p === '/' || p === '/login';

function extractGameId(pathname: string): string | null {
  const m = pathname.match(/^\/(game|bill|settlement)\/([^/]+)/);
  return m ? m[2] : null;
}
const isGameSubPage = (p: string) => /^\/(bill|settlement)\//.test(p);

/**
 * AppShell — 三层 Keep-Alive 架构
 *
 * Layer 0 (最底层): MainLayout (大厅/历史/个人) — 始终挂载
 * Layer 1 (中层):   GameRoom — 当处于游戏上下文时保持挂载
 * Layer 2 (顶层):   账单 / 结算报告 / 加入 / 创建 — 正常挂载/销毁
 */
function AppShell() {
  const location = useLocation();
  const pathname = location.pathname;

  const isPublic = isPublicPath(pathname);
  const isMain = isMainPath(pathname);
  const gameId = extractGameId(pathname);
  const isGamePage = pathname.startsWith('/game/');
  const isGameSub = isGameSubPage(pathname);
  const isGameContext = isGamePage || isGameSub;

  const mainVisible = !isPublic && isMain;
  const mainMounted = !isPublic;

  const [mountedGameId, setMountedGameId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (gameId && gameId !== mountedGameId) {
      setMountedGameId(gameId);
    }
  }, [gameId, mountedGameId]);

  // 离开游戏上下文时，清除挂载的 GameRoom
  React.useEffect(() => {
    if (!isGameContext && !gameId) {
      setMountedGameId(null);
    }
  }, [isGameContext, gameId]);

  const gameRoomVisible = isGamePage;
  const gameRoomMounted = !!mountedGameId && isGameContext;
  const isTopOverlay = !isPublic && !isMain && !isGamePage;

  return (
    <div className="w-full h-[100dvh] bg-white dark:bg-background-dark overflow-hidden relative">

      {/* 公开页 */}
      {isPublic && (
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      )}

      {/* Layer 0: MainLayout — 始终挂载 */}
      {mainMounted && (
        <ProtectedRoute>
          <div
            className="absolute inset-0"
            style={{ visibility: mainVisible ? 'visible' : 'hidden' }}
          >
            <MainLayout />
          </div>
        </ProtectedRoute>
      )}

      {/* Layer 1: GameRoom — 进入游戏后保持挂载，保留所有状态 */}
      {gameRoomMounted && mountedGameId && (
        <ProtectedRoute>
          <div
            className="absolute inset-0 z-10"
            style={{ visibility: gameRoomVisible ? 'visible' : 'hidden' }}
          >
            {/* forcedId 绕过 useParams 在 keep-alive 层外获取不到参数的问题 */}
            <GameRoom forcedId={mountedGameId} />
          </div>
        </ProtectedRoute>
      )}

      {/* Layer 2: 顶层覆盖页 */}
      {isTopOverlay && (
        <div className="absolute inset-0 z-20">
          <ProtectedRoute>
            <Routes>
              <Route path="/join" element={<JoinRoom />} />
              <Route path="/create" element={<CreateGame />} />
              <Route path="/bill/:id" element={<PersonalBill />} />
              <Route path="/settlement/:id" element={<SettlementReport />} />
              <Route path="/lucky-history" element={<LuckyHandHistory />} />
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
      <div className="w-full min-h-screen bg-white dark:bg-background-dark flex justify-center items-center">
        <Router>
          <AppShell />
        </Router>
      </div>
    </UserProvider>
  );
}
