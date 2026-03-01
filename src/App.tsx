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

// ─── 路径判断工具 ─────────────────────────────────────────────────────────────
const MAIN_PATHS = ['/lobby', '/history', '/profile'];
const isMainPath = (p: string) => MAIN_PATHS.includes(p);
const isPublicPath = (p: string) => p === '/' || p === '/login';

// 从路径解析 gameId：/game/:id  /bill/:id  /settlement/:id 都属于同一个游戏上下文
function extractGameId(pathname: string): string | null {
  const m = pathname.match(/^\/(game|bill|settlement)\/([^/]+)/);
  return m ? m[2] : null;
}

// 判断是否是游戏的"子页面"（账单 / 结算报告），需要在后台保留 GameRoom
const isGameSubPage = (p: string) =>
  /^\/(bill|settlement)\//.test(p);

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
  const isGameSub = isGameSubPage(pathname); // bill/:id 或 settlement/:id
  const isGameContext = isGamePage || isGameSub; // 任何与游戏相关的页面

  // 是否显示 MainLayout（不是公开页且不在游戏上下文中）
  const mainVisible = !isPublic && isMain;
  // 是否保持 MainLayout 挂载（除了公开页，一直挂着）
  const mainMounted = !isPublic;

  // GameRoom 应保持挂载（进入游戏相关页面后不销毁）
  const [mountedGameId, setMountedGameId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (gameId && gameId !== mountedGameId) {
      setMountedGameId(gameId);
    }
  }, [gameId]);

  // GameRoom 是否可见（只有在 /game/:id 时才显示）
  const gameRoomVisible = isGamePage;
  // GameRoom 是否挂载（在游戏上下文中始终保持）
  const gameRoomMounted = !!mountedGameId && isGameContext;

  // 顶层覆盖页：join / create / bill / settlement
  const isTopOverlay = !isPublic && !isMain && !isGamePage;

  return (
    <div className="w-full max-w-[430px] h-[100dvh] sm:h-[min(932px,100dvh)] sm:rounded-[2.5rem] sm:border-[8px] border-gray-800 dark:border-gray-950 bg-white dark:bg-background-dark overflow-hidden relative shadow-2xl">

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

      {/* Layer 1: GameRoom — 进入游戏后保持挂载，离开游戏上下文后销毁 */}
      {gameRoomMounted && mountedGameId && (
        <ProtectedRoute>
          <div
            className="absolute inset-0 z-10"
            style={{ visibility: gameRoomVisible ? 'visible' : 'hidden' }}
          >
            {/* 使用 key=mountedGameId 确保切换房间时重新创建 */}
            <GameRoom key={mountedGameId} />
          </div>
        </ProtectedRoute>
      )}

      {/* Layer 2: 顶层覆盖页（join / create / bill / settlement） */}
      {isTopOverlay && (
        <div className="absolute inset-0 z-20">
          <ProtectedRoute>
            <Routes>
              <Route path="/join" element={<JoinRoom />} />
              <Route path="/create" element={<CreateGame />} />
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
