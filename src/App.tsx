import React, { useEffect, useRef } from 'react';
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

function extractGameId(pathname: string): string | null {
  const m = pathname.match(/^\/(game|bill|settlement)\/([^/]+)/);
  return m ? m[2] : null;
}
const isGameSubPage = (p: string) => /^\/(bill|settlement)\//.test(p);

// ─── iOS 风格页面过渡 Hook ────────────────────────────────────────────────────
/**
 * iOS push: 新页面从右侧滑入
 * iOS pop:  当前页面滑出到右侧（通过返回按钮）
 * 通过监听路由层级判断是 push 还是 pop。
 * 层级从低到高: public < main < overlay < gameSub
 */
function getPathLevel(p: string): number {
  if (isPublicPath(p)) return 0;
  if (isMainPath(p)) return 1;
  if (p.startsWith('/game/')) return 2;
  if (isGameSubPage(p)) return 3;
  // create / join
  return 2;
}

function useIOSTransition(containerRef: React.RefObject<HTMLDivElement>, pathname: string) {
  const prevPathRef = useRef(pathname);
  const animatingRef = useRef(false);

  useEffect(() => {
    const prevLevel = getPathLevel(prevPathRef.current);
    const nextLevel = getPathLevel(pathname);
    prevPathRef.current = pathname;

    if (animatingRef.current) return;
    if (prevLevel === nextLevel) return;

    const el = containerRef.current;
    if (!el) return;

    animatingRef.current = true;
    const isPush = nextLevel > prevLevel;

    // Start position
    el.style.transform = isPush ? 'translateX(100%)' : 'translateX(-30%)';
    el.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 320ms cubic-bezier(0.42, 0, 0.58, 1)';
        el.style.transform = 'translateX(0%)';
        const end = () => {
          el.style.transition = '';
          el.style.transform = '';
          animatingRef.current = false;
          el.removeEventListener('transitionend', end);
        };
        el.addEventListener('transitionend', end, { once: true });
      });
    });
  }, [pathname]);
}

/**
 * AppShell — 三层 Keep-Alive + iOS 过渡动画
 */
function AppShell() {
  const location = useLocation();
  const pathname = location.pathname;
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [gameId]);

  const gameRoomVisible = isGamePage;
  const gameRoomMounted = !!mountedGameId && isGameContext;
  const isTopOverlay = !isPublic && !isMain && !isGamePage;

  // iOS 过渡动画
  useIOSTransition(containerRef, pathname);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[430px] h-[100dvh] sm:h-[min(932px,100dvh)] sm:rounded-[2.5rem] sm:border-[8px] border-gray-800 dark:border-gray-950 bg-white dark:bg-background-dark overflow-hidden relative shadow-2xl"
    >
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

      {/* Layer 1: GameRoom — 进入游戏后保持挂载 */}
      {gameRoomMounted && mountedGameId && (
        <ProtectedRoute>
          <div
            className="absolute inset-0 z-10"
            style={{ visibility: gameRoomVisible ? 'visible' : 'hidden' }}
          >
            <GameRoom key={mountedGameId} />
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
