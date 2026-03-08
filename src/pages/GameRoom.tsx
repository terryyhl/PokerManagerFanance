import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import anime from 'animejs';
import { QRCodeSVG } from 'qrcode.react';
import AnimatedPage from '../components/AnimatedPage';

import { gamesApi, buyInApi, pendingBuyInApi, luckyHandsApi, BuyIn, Game, Player } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useGameSSE, PendingBuyinEvent, ActiveTimerEvent, InteractionEvent } from '../hooks/useGameSSE';
import Avatar from '../components/Avatar';
import LuckyHandFAB, { LuckyHandData } from '../components/LuckyHandFAB';
import CardSelectorModal from '../components/CardSelectorModal';
import PlayerStatsModal from '../components/PlayerStatsModal';
import PokerCardDisp from '../components/PokerCardDisp';
import HandComboDisp from '../components/HandComboDisp';
import LuckyHandsTVDashboard from '../components/LuckyHandsTVDashboard';
import LuckyHandCelebration from '../components/LuckyHandCelebration';
import PlayerActionPopup, { PlayerActionTarget } from '../components/PlayerActionPopup';
import ShameTimerOverlay from '../components/ShameTimerOverlay';
import EggThrowAnimation from '../components/EggThrowAnimation';
import ChickenCatchAnimation from '../components/ChickenCatchAnimation';
import FlowerAnimation from '../components/FlowerAnimation';
import { timerApi } from '../lib/api';

interface GameRoomProps {
  forcedId?: string;
}

export default function GameRoom({ forcedId }: GameRoomProps = {}) {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const id = forcedId ?? paramId;
  const { user } = useUser();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const hasScrolledRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [game, setGame] = useState<Game | null>(null);
  const [buyIns, setBuyIns] = useState<BuyIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBuyIn, setShowBuyIn] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState('');
  const [checkoutChips, setCheckoutChips] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 带入审核：待审核队列（SSE 实时推送，房主可见）
  const [pendingRequests, setPendingRequests] = useState<PendingBuyinEvent[]>([]);
  // 房间玩家列表
  const [players, setPlayers] = useState<Player[]>([]);

  // 房间码弹窗
  const [showRoomCode, setShowRoomCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // 密码验证门禁
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordPin, setPasswordPin] = useState<string[]>(['', '', '', '', '', '']);
  const [passwordError, setPasswordError] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);

  // 通知 Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  // 审核确认对话框
  const [confirmReq, setConfirmReq] = useState<PendingBuyinEvent | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lucky Hands States
  const [luckyHands, setLuckyHands] = useState<LuckyHandData[]>([]);
  const [allLuckyHands, setAllLuckyHands] = useState<import('../lib/api').LuckyHand[]>([]);
  const [pendingLuckyHits, setPendingLuckyHits] = useState<import('../lib/api').PendingLuckyHit[]>([]);
  const [isCardSelectorOpen, setIsCardSelectorOpen] = useState(false);
  const [targetHandIndex, setTargetHandIndex] = useState(1);
  const [isModifyingLuckyHand, setIsModifyingLuckyHand] = useState(false);
  const [directHitConfirmHand, setDirectHitConfirmHand] = useState<LuckyHandData | null>(null);
  const [showTVDashboard, setShowTVDashboard] = useState(false);

  const [selectedPlayerStats, setSelectedPlayerStats] = useState<{ id: string; username: string } | null>(null);

  // 长按交互
  const [actionPopupTarget, setActionPopupTarget] = useState<PlayerActionTarget | null>(null);
  const [shameTimerTarget, setShameTimerTarget] = useState<{ userId: string; username: string } | null>(null);
  const [eggTarget, setEggTarget] = useState<{ username: string; rect: DOMRect } | null>(null);
  const [chickenTarget, setChickenTarget] = useState<{ username: string; rect: DOMRect } | null>(null);
  const [flowerTarget, setFlowerTarget] = useState<{ username: string; rect: DOMRect } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // 房主代操作弹窗
  const [proxyTarget, setProxyTarget] = useState<{ userId: string; username: string; action: 'buyin' | 'checkout' } | null>(null);
  const [proxyAmount, setProxyAmount] = useState('');
  const [proxySubmitting, setProxySubmitting] = useState(false);

  // 撤码弹窗
  const [withdrawTarget, setWithdrawTarget] = useState<{ userId: string; username: string } | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // 实时广播催促计时器
  const [activeTimer, setActiveTimer] = useState<ActiveTimerEvent | null>(null);
  const [viewingTimer, setViewingTimer] = useState(false); // 是否正在查看广播来的计时器

  // 被催促时的剩余秒数（用于全屏红色警告）
  const [timerRemaining, setTimerRemaining] = useState(0);

  // 追踪催促计时器剩余时间（判断是否被催促的我 + 是否 ≤10s 显示红色警告）
  const isMeBeingTimed = !!activeTimer && activeTimer.targetUserId === user?.id;
  useEffect(() => {
    if (!activeTimer) { setTimerRemaining(0); return; }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
      return Math.max(0, activeTimer.totalSeconds - elapsed);
    };
    setTimerRemaining(calc());
    const iv = setInterval(() => {
      const r = calc();
      setTimerRemaining(r);
      if (r <= 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  // 工具按钮展开面板
  const [showToolsFan, setShowToolsFan] = useState(false);
  const toolsBtnRef = useRef<HTMLButtonElement>(null);
  const toolsPanelRef = useRef<HTMLDivElement>(null);
  const toolsBackdropRef = useRef<HTMLDivElement>(null);
  const toolsOpenRef = useRef(false);

  /** 停止工具面板所有正在运行的动画 */
  const killToolsAnime = useCallback(() => {
    const btn = toolsBtnRef.current;
    const panel = toolsPanelRef.current;
    const backdrop = toolsBackdropRef.current;
    if (btn) anime.remove(btn);
    if (panel) anime.remove(panel);
    if (backdrop) anime.remove(backdrop);
    anime.remove('.tools-fan-item');
  }, []);

  // 流畅的 ease-out-expo 曲线
  const EASE_OUT = 'cubicBezier(0.16, 1, 0.3, 1)';
  const EASE_IN = 'cubicBezier(0.4, 0, 1, 1)';

  const openToolsFan = useCallback(() => {
    if (toolsOpenRef.current) return;
    toolsOpenRef.current = true;
    setShowToolsFan(true);
    killToolsAnime();

    const btn = toolsBtnRef.current;
    const panel = toolsPanelRef.current;
    const backdrop = toolsBackdropRef.current;
    const items = panel?.querySelectorAll('.tools-fan-item');

    // 按钮：平滑旋转 45° + 过渡到 primary 色（通过 CSS transition）
    if (btn) {
      anime({ targets: btn, rotate: [0, 45], duration: 300, easing: EASE_OUT });
    }

    // 背景遮罩淡入
    if (backdrop) {
      backdrop.style.pointerEvents = 'auto';
      anime({ targets: backdrop, opacity: [0, 1], duration: 250, easing: EASE_OUT });
    }

    // 面板：用 maxHeight + opacity 代替 height 动画，避免 layout thrash
    if (panel) {
      const targetH = panel.scrollHeight || 100;
      anime({ targets: panel, height: [0, targetH], opacity: [0, 1], duration: 300, easing: EASE_OUT });
    }

    // 工具图标：交错淡入 + 轻微上移（无 scale 弹跳）
    if (items) {
      anime({
        targets: items,
        opacity: [0, 1],
        scale: [0.8, 1],
        translateY: [8, 0],
        delay: anime.stagger(40, { start: 80 }),
        duration: 280,
        easing: EASE_OUT,
      });
    }
  }, [killToolsAnime]);

  const closeToolsFan = useCallback(() => {
    if (!toolsOpenRef.current) return;
    toolsOpenRef.current = false;
    setShowToolsFan(false);
    killToolsAnime();

    const btn = toolsBtnRef.current;
    const panel = toolsPanelRef.current;
    const backdrop = toolsBackdropRef.current;
    const items = panel?.querySelectorAll('.tools-fan-item');

    // 按钮旋回
    if (btn) {
      anime({ targets: btn, rotate: 0, duration: 200, easing: EASE_OUT });
    }

    // 工具图标快速淡出（退出比进入快）
    if (items) {
      anime({ targets: items, opacity: 0, scale: 0.8, translateY: 4, duration: 120, easing: EASE_IN });
    }

    // 背景遮罩淡出
    if (backdrop) {
      anime({ targets: backdrop, opacity: 0, duration: 180, easing: EASE_IN, complete: () => { backdrop.style.pointerEvents = 'none'; } });
    }

    // 面板收起
    if (panel) {
      anime({ targets: panel, height: 0, opacity: 0, duration: 200, easing: EASE_IN });
    }
  }, [killToolsAnime]);

  const handleToggleToolsFan = useCallback(() => {
    if (toolsOpenRef.current) {
      closeToolsFan();
    } else {
      openToolsFan();
    }
  }, [openToolsFan, closeToolsFan]);

  // 幸运手牌命中庆祝动画
  const [celebrationData, setCelebrationData] = useState<{ combo: string; username: string; hitCount: number } | null>(null);
  const prevAllLuckyHandsRef = useRef<import('../lib/api').LuckyHand[]>([]);

  // #26 自定义确认修改手牌的 Modal 状态
  const [modifyConfirm, setModifyConfirm] = useState<{ card1: string; card2: string } | null>(null);

  // 买入成功状态
  const [buyinSuccess, setBuyinSuccess] = useState<{ amount: number; total: number } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── 缓存工具 ──────────────────────────────────────────────────────────────
  const cacheKey = id ? `gameroom-cache-${id}` : '';

  /** 写入 sessionStorage 缓存 */
  const writeCache = useCallback((gameData: Game, buyInsData: BuyIn[], playersData: Player[]) => {
    if (!cacheKey) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ game: gameData, buyIns: buyInsData, players: playersData, ts: Date.now() }));
    } catch { /* quota exceeded — 静默忽略 */ }
  }, [cacheKey]);

  /** 读取 sessionStorage 缓存（10分钟内有效） */
  const readCache = useCallback((): { game: Game; buyIns: BuyIn[]; players: Player[] } | null => {
    if (!cacheKey) return null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > 10 * 60 * 1000) { sessionStorage.removeItem(cacheKey); return null; }
      return parsed;
    } catch { return null; }
  }, [cacheKey]);

  const fetchGame = async () => {
    if (!id || !user) return;
    try {
      const {
        game: gameData,
        buyIns: buyInsData,
        players: playersData,
        pendingRequests: pendingData,
        luckyHands: luckyHandsData,
        pendingLuckyHits: pendingLuckyData,
      } = await gamesApi.getFullState(id, user.id);

      const normalizedGame = { ...gameData, created_at: gameData.created_at || new Date().toISOString() };
      setGame(normalizedGame);
      setBuyIns(buyInsData);
      setPlayers(playersData);

      // 写入缓存
      writeCache(normalizedGame, buyInsData, playersData);

      // 房主: 恢复待审核购买列表
      setPendingRequests(pendingData.map(r => ({
        id: r.id,
        gameId: r.gameId,
        userId: r.userId,
        username: r.username,
        amount: r.amount,
        totalBuyIn: r.totalBuyIn,
        type: r.type,
        createdAt: r.createdAt,
      })));

      // 幸运手牌
      if (gameData.lucky_hands_count > 0) {
        setAllLuckyHands(luckyHandsData);
        setLuckyHands(luckyHandsData.filter((h) => h.user_id === user.id));
        setPendingLuckyHits(pendingLuckyData);
      }

      const isMember = (playersData as Player[]).some(p => p.user_id === user.id);
      if (!isMember) setNeedsPassword(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Stale-While-Revalidate：有缓存先渲染，后台静默刷新
    const cached = readCache();
    if (cached && user) {
      setGame(cached.game);
      setBuyIns(cached.buyIns);
      setPlayers(cached.players);
      const isMember = cached.players.some(p => p.user_id === user.id);
      if (!isMember) setNeedsPassword(true);
      setIsLoading(false);
    }
    fetchGame();
    return () => {
      // 清理 fetchTimeout，防止卸载后更新 state
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [id, user]);


  // 初次加载完成：立即跳到底部（使用 useLayoutEffect 避免绘制后发生肉眼抖动）
  useLayoutEffect(() => {
    if (!isLoading && scrollContainerRef.current && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [isLoading]);

  // 检测幸运手牌命中 → 触发全屏庆祝动画
  useEffect(() => {
    const prev = prevAllLuckyHandsRef.current;
    if (prev.length > 0 && allLuckyHands.length > 0) {
      for (const curr of allLuckyHands) {
        const prevHand = prev.find(p => p.id === curr.id);
        if (prevHand && curr.hit_count > prevHand.hit_count) {
          const owner = players.find(p => p.user_id === curr.user_id);
          const name = owner?.users?.username || '某人';
          setCelebrationData({
            combo: curr.card_1,
            username: name,
            hitCount: curr.hit_count,
          });
          break; // 一次只显示一个庆祝动画
        }
      }
    }
    prevAllLuckyHandsRef.current = JSON.parse(JSON.stringify(allLuckyHands));
  }, [allLuckyHands, players]);

  // 新买入/待审核出现：平滑滚动到底部
  useEffect(() => {
    if (scrollContainerRef.current && hasScrolledRef.current) {
      const el = scrollContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [buyIns.length, pendingRequests.length]);

  // ── SSE 长连接 ─────────────────────────────────────────────────────────────
  // 根据 userId 查找头像栏中对应头像的 DOMRect
  const getAvatarRect = useCallback((targetUserId: string): DOMRect | null => {
    const el = document.querySelector(`[data-player-id="${targetUserId}"]`);
    return el ? el.getBoundingClientRect() : null;
  }, []);

  const { markPendingSubmitted, broadcastTimerStart, broadcastTimerStop, broadcastInteraction, broadcastKick, setActiveTimerRef } = useGameSSE(id, user?.id, {
    onConnected: (isHost) => {
      console.log('[SSE] connected, isHost=', isHost);
    },
    // 房主收到新的待审核申请（已在 Hook 内过滤掉自己的申请）
    onBuyinRequest: (req) => {
      setPendingRequests(prev => {
        if (prev.find(r => r.id === req.id)) return prev;
        return [...prev, req];
      });
      showToast(`${req.username} 申请${req.type === 'initial' ? '买入' : '重买'} ${req.amount} 积分`, 'info');
    },
    // 房主上线时同步当前待审核列表
    onPendingList: (list) => {
      setPendingRequests(list);
    },
    // 所有用户：游戏数据刷新
    onGameRefresh: () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchGame();
      }, 300);
    },
    // 申请用户：审核通过通知（由 buy_ins INSERT 事件触发）
    onBuyinApproved: (data) => {
      showToast(`✅ 买入申请已通过！${data.amount} 积分`, 'success');
      // 从当前已有买入记录计算总额，加上本次审核通过的金额
      const existingTotal = buyIns
        .filter(b => b.user_id === user?.id && (b.type === 'initial' || b.type === 'rebuy'))
        .reduce((sum, b) => sum + b.amount, 0);
      setBuyinSuccess({ amount: data.amount, total: existingTotal + data.amount });
      setShowBuyIn(true);
      // buy_ins INSERT 已经触发了 onGameRefresh → fetchGame，无需重复调用
    },
    // 申请用户：审核拒绝通知
    onBuyinRejected: (data) => {
      showToast(`❌ 买入申请被拒绝 $${data.amount}`, 'error');
      setPendingRequests(prev => prev.filter(r => r.id !== data.requestId));
    },
    // 所有人：游戏已结算，自动跳转到结算报告页
    onGameSettled: (data) => {
      showToast(data.message, 'success');
      setTimeout(() => {
        navigate(`/settlement/${id}`, { replace: true });
      }, 1500);
    },
    // 收到广播：有人对某玩家开启了催促计时
    onTimerStart: (data) => {
      setActiveTimer(data);
    },
    // 收到广播：催促计时结束
    onTimerStop: () => {
      setActiveTimer(null);
      setViewingTimer(false);
    },
    // 收到广播：趣味互动（扔蛋/抓鸡/送花），所有用户播放动画
    onInteraction: (data: InteractionEvent) => {
      const rect = getAvatarRect(data.targetUserId);
      if (!rect) return;
      if (data.type === 'egg') {
        setEggTarget({ username: data.targetUsername, rect });
      } else if (data.type === 'chicken') {
        setChickenTarget({ username: data.targetUsername, rect });
      } else if (data.type === 'flower') {
        setFlowerTarget({ username: data.targetUsername, rect });
      }
    },
  });

  const isHost = user?.id === game?.created_by;
  const needsApproval = game?.insurance_mode === true;

  // 密码键盘
  const handlePinKey = (key: string) => {
    if (key === 'clear') {
      setPasswordPin(['', '', '', '', '', '']); return;
    } else if (key === 'backspace') {
      const p = [...passwordPin];
      for (let i = 5; i >= 0; i--) { if (p[i] !== '') { p[i] = ''; setPasswordPin(p); return; } }
    } else {
      const p = [...passwordPin];
      for (let i = 0; i < 6; i++) { if (p[i] === '') { p[i] = key; setPasswordPin(p); return; } }
    }
  };

  const handlePasswordSubmit = async () => {
    const code = passwordPin.join('');
    if (code.length !== 6 || !user || !id) return;
    setJoiningGame(true); setPasswordError('');
    try {
      await gamesApi.join(code, user.id);
      setNeedsPassword(false);
      await fetchGame();
    } catch {
      setPasswordError('密码错误或房间不存在');
      setPasswordPin(['', '', '', '', '', '']);
    } finally { setJoiningGame(false); }
  };

  const handleCopyCode = () => {
    if (!game?.room_code) return;
    navigator.clipboard.writeText(game.room_code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── 长按头像交互 ────────────────────────────────────────────────────────────
  const handleAvatarTouchStart = useCallback((playerId: string, playerName: string, e: React.TouchEvent | React.MouseEvent) => {
    longPressFiredRef.current = false;
    const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      // 触发触觉反馈（如果支持）
      if ('vibrate' in navigator) navigator.vibrate(30);
      setActionPopupTarget({ userId: playerId, username: playerName, rect: target });
    }, 500);
  }, []);

  const handleAvatarTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleAvatarClick = useCallback((playerId: string, playerName: string) => {
    // 如果是长按触发了弹窗，忽略 click
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    // 如果该玩家正在被催促，打开计时器 viewer 而不是个人面板
    if (activeTimer?.targetUserId === playerId) {
      setViewingTimer(true);
      return;
    }
    setSelectedPlayerStats({ id: playerId, username: playerName });
  }, [activeTimer]);

  const handleStartTimer = useCallback(() => {
    if (!actionPopupTarget) return;
    const target = { userId: actionPopupTarget.userId, username: actionPopupTarget.username };
    setActionPopupTarget(null);
    setShameTimerTarget(target);
  }, [actionPopupTarget]);

  // 用户在 ShameTimerOverlay 中选择了预设 → 广播给所有人
  const handleTimerStarted = useCallback((totalSeconds: number, startedAt: number) => {
    if (!shameTimerTarget || !user) return;
    const event: ActiveTimerEvent = {
      targetUserId: shameTimerTarget.userId,
      targetUsername: shameTimerTarget.username,
      startedBy: user.id,
      startedByUsername: user.username,
      totalSeconds,
      startedAt,
    };
    // 自己也设置 activeTimer（发起者本身也能看到头像发光）
    setActiveTimer(event);
    broadcastTimerStart(event);
  }, [shameTimerTarget, user, broadcastTimerStart]);

  const handleStopTimer = useCallback(async (durationSeconds: number) => {
    if (!shameTimerTarget || !user || !id) return;
    // 广播停止
    broadcastTimerStop(shameTimerTarget.userId);
    setActiveTimer(null);
    try {
      await timerApi.record(id, shameTimerTarget.userId, user.id, 'timer', durationSeconds);
      showToast(`${shameTimerTarget.username} 思考了 ${durationSeconds} 秒`, 'info');
    } catch (err) {
      console.error('Record timer error:', err);
    }
    setShameTimerTarget(null);
  }, [shameTimerTarget, user, id, broadcastTimerStop]);

  const handleCancelTimer = useCallback(() => {
    if (shameTimerTarget) {
      // 广播停止
      broadcastTimerStop(shameTimerTarget.userId);
      setActiveTimer(null);
    }
    setShameTimerTarget(null);
  }, [shameTimerTarget, broadcastTimerStop]);

  const handleThrowEgg = useCallback(() => {
    if (!actionPopupTarget || !user || !id) return;
    const { userId, username } = actionPopupTarget;
    setActionPopupTarget(null);
    // 广播给所有人播放动画
    broadcastInteraction({ type: 'egg', targetUserId: userId, targetUsername: username, startedBy: user.id, startedByUsername: user.username });
    // 记录扔鸡蛋
    timerApi.record(id, userId, user.id, 'egg').catch(err => console.error('Record egg error:', err));
  }, [actionPopupTarget, user, id, broadcastInteraction]);

  const handleCatchChicken = useCallback(() => {
    if (!actionPopupTarget || !user || !id) return;
    const { userId, username } = actionPopupTarget;
    setActionPopupTarget(null);
    // 广播给所有人播放动画
    broadcastInteraction({ type: 'chicken', targetUserId: userId, targetUsername: username, startedBy: user.id, startedByUsername: user.username });
    // 记录抓鸡
    timerApi.record(id, userId, user.id, 'chicken').catch(err => console.error('Record chicken error:', err));
  }, [actionPopupTarget, user, id, broadcastInteraction]);

  const handleSendFlower = useCallback(() => {
    if (!actionPopupTarget || !user || !id) return;
    const { userId, username } = actionPopupTarget;
    setActionPopupTarget(null);
    // 广播给所有人播放动画
    broadcastInteraction({ type: 'flower', targetUserId: userId, targetUsername: username, startedBy: user.id, startedByUsername: user.username });
    // 记录送花
    timerApi.record(id, userId, user.id, 'flower').catch(err => console.error('Record flower error:', err));
  }, [actionPopupTarget, user, id, broadcastInteraction]);

  // ── 房主代操作 ──────────────────────────────────────────────────────────────
  const handleProxyBuyIn = useCallback(() => {
    if (!selectedPlayerStats) return;
    setProxyTarget({ userId: selectedPlayerStats.id, username: selectedPlayerStats.username, action: 'buyin' });
    setProxyAmount('');
    setSelectedPlayerStats(null);
  }, [selectedPlayerStats]);

  const handleProxyCheckout = useCallback(() => {
    if (!selectedPlayerStats) return;
    setProxyTarget({ userId: selectedPlayerStats.id, username: selectedPlayerStats.username, action: 'checkout' });
    setProxyAmount('');
    setSelectedPlayerStats(null);
  }, [selectedPlayerStats]);

  // 踢人确认状态
  const [kickConfirm, setKickConfirm] = useState<{ userId: string; username: string } | null>(null);
  const [kicking, setKicking] = useState(false);

  const handleKickPlayer = useCallback(() => {
    if (!selectedPlayerStats) return;
    setKickConfirm({ userId: selectedPlayerStats.id, username: selectedPlayerStats.username });
    setSelectedPlayerStats(null);
  }, [selectedPlayerStats]);

  const handleKickConfirm = async () => {
    if (!kickConfirm || !user || !id) return;
    setKicking(true);
    try {
      await gamesApi.kick(id, kickConfirm.userId, user.id);
      broadcastKick(kickConfirm.userId);
      showToast(`已将 ${kickConfirm.username} 移出房间`, 'success');
      setKickConfirm(null);
      await fetchGame();
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setKicking(false);
    }
  };

  const handleProxySubmit = async () => {
    if (!proxyTarget || !user || !id || !proxyAmount) return;

    setProxySubmitting(true);
    try {
      if (proxyTarget.action === 'buyin') {
        // 代购买：输入手数
        const handCount = parseInt(proxyAmount, 10);
        if (isNaN(handCount) || handCount <= 0) { showToast('请输入有效手数', 'error'); setProxySubmitting(false); return; }
        const targetBuyIns = buyIns.filter(b => b.user_id === proxyTarget.userId && (b.type === 'initial' || b.type === 'rebuy'));
        const type = targetBuyIns.length === 0 ? 'initial' : 'rebuy';
        await buyInApi.record(id, proxyTarget.userId, handCount, type, user.id);
        const pph = game?.points_per_hand || 100;
        showToast(`已为 ${proxyTarget.username} 代购买 ${handCount}手 = $${handCount * pph}`, 'success');
      } else {
        // 代结账：输入筹码金额（不走手数）
        const amount = parseInt(proxyAmount, 10);
        if (isNaN(amount) || amount < 0) { showToast('请输入有效金额', 'error'); setProxySubmitting(false); return; }
        await buyInApi.checkout(id, proxyTarget.userId, amount, user.id);
        showToast(`已为 ${proxyTarget.username} 代结账 $${amount}`, 'success');
      }
      setProxyTarget(null);
      await fetchGame();
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setProxySubmitting(false);
    }
  };

  // ── 撤码 ─────────────────────────────────────────────────────────────────
  const handleWithdraw = useCallback(() => {
    if (!actionPopupTarget) return;
    const target = { userId: actionPopupTarget.userId, username: actionPopupTarget.username };
    setActionPopupTarget(null);
    setWithdrawTarget(target);
    setWithdrawAmount('');
  }, [actionPopupTarget]);

  const handleWithdrawSubmit = async () => {
    if (!withdrawTarget || !user || !id || !withdrawAmount) return;
    const handCount = parseInt(withdrawAmount, 10);
    if (isNaN(handCount) || handCount <= 0) { showToast('请输入有效手数', 'error'); return; }

    setWithdrawSubmitting(true);
    try {
      const isProxy = withdrawTarget.userId !== user.id;
      await buyInApi.withdraw(id, withdrawTarget.userId, handCount, isProxy ? user.id : undefined);
      const pph = game?.points_per_hand || 100;
      const who = isProxy ? `${withdrawTarget.username} ` : '';
      showToast(`已为 ${who}撤码 ${handCount}手 = -$${handCount * pph}`, 'success');
      setWithdrawTarget(null);
      await fetchGame();
    } catch (err: any) {
      showToast(err.message || '撤码失败', 'error');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // ── 买入提交 ────────────────────────────────────────────────────────────────
  const handleBuyInSubmit = async () => {
    if (!user || !game || !id || !buyInAmount) return;
    const handCount = parseInt(buyInAmount, 10);
    const pph = game.points_per_hand || 100;
    const maxHands = game.max_hands_per_buy || 10;

    // 校验手数
    if (isNaN(handCount) || handCount <= 0) {
      showToast('请输入有效的手数', 'error');
      return;
    }
    if (handCount > maxHands) {
      showToast(`单次最多买入 ${maxHands} 手`, 'error');
      return;
    }

    const amount = handCount * pph;
    const userBuyIns = buyIns.filter(b => b.user_id === user.id && (b.type === 'initial' || b.type === 'rebuy'));
    const type = userBuyIns.length === 0 ? 'initial' : 'rebuy';

    // 带入审核模式 且 非房主 → 提交待审核申请（Supabase Realtime 通知房主）
    if (needsApproval && !isHost) {
      setSubmitting(true);
      try {
        const { request: pendingReq } = await pendingBuyInApi.submit(id, user.id, user.username, handCount, type);
        // 标记「我已提交待审核申请」，供 SSE Hook 识别后续 buy_ins INSERT 为审批通过
        markPendingSubmitted(amount, type);
        // 将自己的申请加入本地 pending 列表，立即在时间线中显示审核状态
        setPendingRequests(prev => [...prev, {
          id: pendingReq.id,
          gameId: id,
          userId: user.id,
          username: user.username,
          amount,
          totalBuyIn: buyIns.filter(b => b.user_id === user.id && (b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw')).reduce((sum, b) => sum + b.amount, 0),
          type,
          createdAt: new Date().toISOString(),
        }]);
        showToast(`申请已提交（${handCount}手 = $${amount}），等待房主审核...`, 'info');
        setBuyInAmount(''); setShowBuyIn(false);
      } catch (err: any) {
        showToast(err.message || '提交失败', 'error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 直接买入（无审核 or 房主）
    setSubmitting(true);
    try {
      const res = await buyInApi.record(id, user.id, handCount, type);
      await fetchGame();
      setBuyinSuccess({ amount, total: res.totalAmount ?? 0 });
      setBuyInAmount('');
    } catch (err: any) {
      showToast(err.message || '买入失败', 'error');
    } finally { setSubmitting(false); }
  };

  // ── 房主操作待审核申请 ──────────────────────────────────────────────────────
  const handleConfirmApprove = async () => {
    if (!confirmReq) return;
    setConfirming(true);
    try {
      await pendingBuyInApi.approve(confirmReq.id);
      setPendingRequests(prev => prev.filter(r => r.id !== confirmReq.id));
      setConfirmReq(null);
      await fetchGame(); // Immediate update for host
      // SSE game_refresh 广播会触发所有端 fetchGame
    } catch (err: any) { showToast(err.message || '批准失败', 'error'); }
    finally { setConfirming(false); }
  };

  const handleReject = async (req: PendingBuyinEvent) => {
    try {
      await pendingBuyInApi.reject(req.id);
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      await fetchGame(); // Immediate update for host
    } catch (err: any) { showToast(err.message || '拒绝失败', 'error'); }
  };

  // ──────────────── Lucky Hands Handles ────────────────
  const handleSelectSlot = async (handIndex: number, action: 'setup' | 'hit') => {
    if (action === 'setup') {
      setIsModifyingLuckyHand(false);
      setTargetHandIndex(handIndex);
      setIsCardSelectorOpen(true);
    } else if (action === 'hit') {
      // 未全部选好手牌组时，不允许中奖+1
      const totalSlots = game?.lucky_hands_count || 0;
      if (luckyHands.length < totalSlots) {
        showToast('请先设置好全部幸运手牌', 'info');
        return;
      }
      const hand = luckyHands.find(h => h.hand_index === handIndex);
      if (hand) {
        if (isHost && user!.id === game?.created_by) {
          setDirectHitConfirmHand(hand);
        } else {
          try {
            await luckyHandsApi.submitHit(id!, user!.id, (hand as LuckyHandData & { id: string }).id);
            showToast("已向房主发起中奖审核，请等待批准", 'info');
          } catch (e: any) {
            console.error(e);
            showToast(e.message || '中奖申请提交失败', 'error');
          }
        }
      }
    }
  };

  const handleModifyLuckyHandFromStats = (handIndex: number) => {
    setSelectedPlayerStats(null); // 关闭大盘
    setIsModifyingLuckyHand(true);
    setTargetHandIndex(handIndex);
    setIsCardSelectorOpen(true); // 调起选牌
  };

  const handleConfirmCardSelection = async (card1: string, card2: string) => {
    // 立即关闭面板，提升交互响应
    setIsCardSelectorOpen(false);

    // 检查是否与自己其他槽位的组合重复
    const duplicate = luckyHands.find(h => h.hand_index !== targetHandIndex && h.card_1 === card1);
    if (duplicate) {
      showToast(`该组合已在槽位 #${duplicate.hand_index} 中使用`, 'error');
      return;
    }

    try {
      if (isModifyingLuckyHand) {
        const hand = luckyHands.find(h => h.hand_index === targetHandIndex);
        if (hand) {
          if (isHost && user?.id === game?.created_by) {
            // 房主修改自己的 → 弹出自定义确认 Modal
            setModifyConfirm({ card1, card2 });
            return; // 等待 Modal 确认后再执行
          } else {
            await luckyHandsApi.requestUpdate(id!, user!.id, (hand as { id: string }).id, card1, card2);
            showToast("改牌申请已发出，请等待房主同意", 'info');
          }
        }
      } else {
        setLuckyHands(prev => {
          const newHand: LuckyHandData = { id: `temp-${Date.now()}`, hand_index: targetHandIndex, card_1: card1, card_2: card2, hit_count: 0, user_id: user!.id, game_id: id! } as LuckyHandData;
          return [...prev.filter(h => h.hand_index !== targetHandIndex), newHand];
        });
        await luckyHandsApi.setup(id!, user!.id, targetHandIndex, card1, card2);
        showToast("手牌设置完毕", 'success');
      }
    } catch (err) {
      console.error("Setup Card Error", err);
      showToast("操作出现错误", 'error');
    }
  };

  const handleApproveLuckyHit = async (hitId: string) => {
    try {
      await luckyHandsApi.approveHit(id!, hitId);
      setPendingLuckyHits(prev => prev.filter(h => h.id !== hitId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectLuckyHit = async (hitId: string) => {
    try {
      await luckyHandsApi.rejectHit(id!, hitId);
      setPendingLuckyHits(prev => prev.filter(h => h.id !== hitId));
    } catch (e) {
      console.error(e);
    }
  };


  // ── 结账 ────────────────────────────────────────────────────────────────────
  const handleCheckoutSubmit = async () => {
    if (!user || !id || !checkoutChips) return;
    setSubmitting(true);
    try {
      await buyInApi.checkout(id, user.id, parseInt(checkoutChips, 10));
      setShowCheckout(false);
      navigate(`/bill/${id}`);
    } catch (err: any) { showToast(err.message || '结账失败', 'error'); }
    finally { setSubmitting(false); }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const myTotalBuyIn = buyIns
    .filter(b => b.user_id === user?.id && (b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw') && b.hand_count != null)
    .reduce((sum, b) => sum + b.amount, 0);

  // ── 加载中 ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  // ── 密码门禁 ────────────────────────────────────────────────────────────────
  if (needsPassword) {
    const pinFull = passwordPin.join('').length === 6;
    return (
      <AnimatedPage animationType="slide-left">
        <div className="relative flex h-full min-h-full w-full flex-col bg-[#0c1219] text-white poker-texture">
          <div className="absolute top-6 left-4 z-50">
            <button onClick={() => navigate('/lobby', { replace: true })} className="flex items-center justify-center size-10 rounded-full bg-slate-800/60 hover:bg-slate-700 transition-all duration-200 active:scale-90">
              <span className="material-symbols-outlined text-[22px] text-slate-400">close</span>
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(19,127,236,0.15)]">
              <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </div>
            <h2 className="text-2xl font-black mb-1.5 tracking-tight">输入房间密码</h2>
            <p className="text-slate-500 text-sm mb-8">6位数字密码</p>
            <div className="flex gap-2.5 mb-8">
              {passwordPin.map((d, i) => (
                <div key={i} className={`w-10 h-12 flex items-center justify-center rounded-xl border-2 text-2xl font-black transition-all duration-200 ${d ? 'border-primary/60 bg-primary/10 text-white shadow-[0_0_12px_rgba(19,127,236,0.2)]' : 'border-slate-700/50 bg-slate-800/30 text-slate-700'}`}
                  style={d ? { animation: 'pin-glow 2s ease-in-out infinite', animationDelay: `${i * 0.1}s` } : undefined}>
                  {d ? '•' : ''}
                </div>
              ))}
            </div>
            {passwordError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-6 bg-red-500/10 px-4 py-2 rounded-xl">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span className="font-medium">{passwordError}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key, i) => (
                key === 'clear' ? (
                  <button key={i} onClick={() => handlePinKey('clear')} className="flex items-center justify-center h-14 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 active:scale-95 active:bg-slate-600/60 transition-all duration-150 text-xs font-bold text-slate-500">
                    清空
                  </button>
                ) :
                  key === 'backspace' ? (
                    <button key={i} onClick={() => handlePinKey('backspace')} className="flex items-center justify-center h-14 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 active:scale-95 active:bg-slate-600/60 transition-all duration-150">
                      <span className="material-symbols-outlined text-slate-500 text-[22px]">backspace</span>
                    </button>
                  ) : (
                    <button key={i} onClick={() => handlePinKey(key)} className="flex items-center justify-center h-14 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 active:scale-95 active:bg-slate-600/60 transition-all duration-150 text-2xl font-black text-slate-200">
                      {key}
                    </button>
                  )
              ))}
            </div>
            <button onClick={handlePasswordSubmit} disabled={!pinFull || joiningGame}
              className="mt-6 w-full max-w-[280px] py-4 rounded-2xl bg-primary hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {joiningGame ? '验证中...' : <><span>进入房间</span><span className="material-symbols-outlined text-[18px]">arrow_forward</span></>}
            </button>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  // ── 主游戏界面 ──────────────────────────────────────────────────────────────
  return (
    <AnimatedPage animationType="slide-left">
      <div className="bg-background-light dark:bg-background-dark min-h-full h-full text-slate-900 dark:text-slate-100 font-display antialiased overflow-hidden flex flex-col" onContextMenu={(e) => e.preventDefault()}>

        {/* 被催促红色边缘警告（≤10秒） */}
        {isMeBeingTimed && timerRemaining <= 10 && timerRemaining > 0 && (
          <div className="fixed inset-0 z-[100] pointer-events-none animate-shame-edge-glow" />
        )}
        {isMeBeingTimed && timerRemaining === 0 && activeTimer && (
          <div className="fixed inset-0 z-[100] pointer-events-none animate-shame-edge-glow-intense" />
        )}

        {/* Toast 通知 */}
        {toast && (
          <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white transition-all ${toast.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/20' : toast.type === 'error' ? 'bg-red-600 shadow-red-500/20' : 'bg-slate-700 shadow-slate-900/30'
            }`}>
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            {toast.msg}
          </div>
        )}

        <header className="sticky top-0 z-20 flex items-center justify-between bg-background-light dark:bg-background-dark px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center size-9 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 transition-all duration-200">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            </button>
            <div>
              <h2 className="text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">{game?.name || '牌局'}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-500 tracking-wider">{game?.room_code}</span>
                <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
                <span className="text-[10px] font-bold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-md">盲注 {game?.blind_level}</span>
                {needsApproval && <span className="bg-amber-500/15 text-amber-600 dark:text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-md">审核</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowRoomCode(true)} className="flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/60 size-9 text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all duration-200">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/60 mx-0.5" />
            <button onClick={() => navigate(`/settlement/${id}`)} className="flex items-center justify-center gap-1 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-bold text-primary hover:bg-primary/20 transition-all duration-200">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>receipt_long</span>账单
            </button>
          </div>
          {/* primary 品牌渐变线 */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </header>

        {/* 房间参与者列表 */}
        <div className="flex items-center bg-background-light dark:bg-gradient-to-b dark:from-[#0d1620] dark:to-background-dark border-b border-slate-200 dark:border-transparent">
          {/* 头像滚动区 — flex-1 占满剩余空间 */}
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-4 px-4 py-3">
              {[...players]
                .sort((a, b) => {
                  // 房主永远排第一
                  if (a.user_id === game?.created_by) return -1;
                  if (b.user_id === game?.created_by) return 1;
                  // 有座位号的按座位号升序
                  const sa = a.seat_number ?? Infinity;
                  const sb = b.seat_number ?? Infinity;
                  return sa - sb;
                })
                .map(player => {
                  const isPlayerHost = player.user_id === game?.created_by;
                  const hasCheckedOut = buyIns.some(b => b.user_id === player.user_id && b.type === 'checkout');
                  const isBeingTimed = activeTimer?.targetUserId === player.user_id;
                  const isSelf = player.user_id === user?.id;
                  return (
                    <div key={player.id} data-player-id={player.user_id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                      onClick={() => handleAvatarClick(player.user_id, player.users?.username || '?')}
                      onTouchStart={(e) => handleAvatarTouchStart(player.user_id, player.users?.username || '?', e)}
                      onTouchEnd={handleAvatarTouchEnd}
                      onTouchCancel={handleAvatarTouchEnd}
                      onMouseDown={(e) => handleAvatarTouchStart(player.user_id, player.users?.username || '?', e)}
                      onMouseUp={handleAvatarTouchEnd}
                      onMouseLeave={handleAvatarTouchEnd}
                    >
                      <div className="relative">
                        {/* 被催促时：脉冲发光环 */}
                        {isBeingTimed && (
                          <div className="absolute -inset-1.5 rounded-full animate-ping bg-red-500/20" />
                        )}
                        {isBeingTimed && (
                          <div className="absolute -inset-1.5 rounded-full bg-red-500/15 animate-pulse" />
                        )}
                        {/* 自己的头像 primary 光环 */}
                        {isSelf && !hasCheckedOut && !isBeingTimed && (
                          <div className="absolute -inset-0.5 rounded-full ring-2 ring-primary/40" />
                        )}
                        <Avatar
                          username={player.users?.username || '?'}
                          isAdmin={isPlayerHost}
                          className={`${isSelf ? 'w-12 h-12' : 'w-10 h-10'} ${hasCheckedOut ? 'opacity-40 grayscale' : ''} ${isBeingTimed ? 'ring-2 ring-red-500 shadow-[0_0_16px_rgba(239,68,68,0.5)]' : ''}`}
                        />
                        {/* 房主：金皇冠 */}
                        {isPlayerHost && !hasCheckedOut && !isBeingTimed && (
                          <div className="absolute -top-1.5 -right-1.5 text-amber-400 drop-shadow-md">
                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                          </div>
                        )}
                        {/* 结账勾 */}
                        {hasCheckedOut && (
                          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background-dark">
                            <span className="material-symbols-outlined text-white text-[10px]">check</span>
                          </div>
                        )}
                        {isBeingTimed && activeTimer && (
                          <div
                            className="absolute -bottom-1.5 -right-1.5 cursor-pointer z-10"
                            onClick={(e) => { e.stopPropagation(); setViewingTimer(true); }}
                          >
                            {/* 迷你进度环 */}
                            {(() => {
                              const timerProg = activeTimer.totalSeconds > 0 ? timerRemaining / activeTimer.totalSeconds : 0;
                              const mr = 9; const mc = 2 * Math.PI * mr;
                              const miniColor = timerRemaining <= 10 ? '#ef4444' : timerRemaining <= 30 ? '#f97316' : '#f59e0b';
                              return (
                                <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-md">
                                  <circle cx="12" cy="12" r="11" fill="#101922" />
                                  <circle cx="12" cy="12" r={mr} fill="none" strokeWidth="2.5" stroke="#334155" />
                                  <circle cx="12" cy="12" r={mr} fill="none" strokeWidth="2.5"
                                    strokeLinecap="round" stroke={miniColor}
                                    strokeDasharray={mc} strokeDashoffset={mc * (1 - timerProg)}
                                    transform="rotate(-90 12 12)"
                                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                                  />
                                  <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central"
                                    fill={miniColor} fontSize="8" fontWeight="900" fontFamily="monospace">
                                    {timerRemaining}
                                  </text>
                                </svg>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold truncate max-w-[50px] ${isBeingTimed ? 'text-red-500 dark:text-red-400' : hasCheckedOut ? 'text-emerald-500/70' : isSelf ? 'text-primary' : isPlayerHost ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500'}`}>
                        {isSelf ? '自己' : player.users?.username}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="shrink-0 w-px self-stretch my-2 bg-slate-700/40" />

          {/* 工具按钮 — 固定在右侧，不参与滚动 */}
          <div className="shrink-0 flex items-center px-3">
            <button
              ref={toolsBtnRef}
              onClick={handleToggleToolsFan}
              className="tools-fan-btn w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 ring-1 ring-primary/20 active:scale-90 transition-transform duration-150"
            >
              <span className="material-symbols-outlined text-primary/80 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                handyman
              </span>
            </button>
          </div>
        </div>

        {/* 工具展开面板 — 始终挂载，通过动画控制可见性 */}
        <div
          ref={toolsBackdropRef}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          style={{ opacity: 0, pointerEvents: 'none' }}
          onClick={closeToolsFan}
        />
        <div
          ref={toolsPanelRef}
          className="relative z-40 overflow-hidden"
          style={{ height: 0, opacity: 0 }}
        >
          <div className="bg-white/98 dark:bg-[#151f2b]/98 border-b border-slate-200 dark:border-slate-700/50 px-4 py-4 dark:poker-texture">
            <div className="grid grid-cols-6 gap-2">
              {[
                { icon: 'event_seat', label: '座位', color: 'text-emerald-400', bg: 'bg-emerald-500/8', path: '/tools/seat', withPlayers: true },
                { icon: 'person_pin_circle', label: '庄家', color: 'text-purple-400', bg: 'bg-purple-500/8', path: '/tools/picker', withPlayers: true },
                { icon: 'timer', label: '时钟', color: 'text-blue-400', bg: 'bg-blue-500/8', path: '/tools/clock', withPlayers: false },
                { icon: 'monetization_on', label: '硬币', color: 'text-amber-400', bg: 'bg-amber-500/8', path: '/tools/coin', withPlayers: false },
                { icon: 'analytics', label: '概率', color: 'text-indigo-400', bg: 'bg-indigo-500/8', path: '/tools/odds', withPlayers: false },
                { icon: 'casino', label: '骰子', color: 'text-orange-400', bg: 'bg-orange-500/8', path: '/tools/dice', withPlayers: false },
              ].map((tool, idx) => (
                <button
                  key={tool.path}
                  onClick={() => {
                    closeToolsFan();
                    const state: Record<string, unknown> = { fromGame: true };
                    if (tool.path === '/tools/seat') {
                      // 座位工具：传完整玩家信息 + 历史座位号 + gameId + hostId
                      state.players = players.map(p => ({ userId: p.user_id, username: p.users?.username || '?', seatNumber: p.seat_number ?? null }));
                      state.gameId = id;
                      state.hostId = user?.id;
                    } else if (tool.withPlayers) {
                      state.players = players.map(p => p.users?.username || '?');
                    }
                    navigate(tool.path, { state });
                  }}
                  className={`tools-fan-item flex flex-col items-center gap-1.5 py-2.5 rounded-xl active:scale-90 transition-transform duration-150 ${tool.bg} hover:bg-white/5`}
                  style={{ opacity: 0, transform: 'scale(0) translateY(-10px)' }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tool.bg}`}>
                    <span className={`material-symbols-outlined text-[22px] ${tool.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{tool.icon}</span>
                  </div>
                  <span className={`text-[10px] font-bold ${tool.color}`}>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 房间码 + 二维码弹窗 */}
        {showRoomCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowRoomCode(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-xs rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-6 flex flex-col items-center text-center">
                <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-3">房间密码</p>
                <div className="flex justify-center gap-2 mb-4">
                  {(game?.room_code || '------').split('').map((d, i) => (
                    <span key={i} className="w-10 h-12 flex items-center justify-center bg-slate-800 rounded-lg text-2xl font-black text-white border border-slate-700">{d}</span>
                  ))}
                </div>
                <button onClick={handleCopyCode} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-sm font-medium mb-4">
                  <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? '已复制！' : '复制密码'}
                </button>
                {/* 扫码加入二维码 */}
                <div className="w-full flex flex-col items-center mb-4">
                  <div className="bg-white p-3 rounded-xl shadow-inner mb-2">
                    <QRCodeSVG
                      value={`${window.location.origin}/join/${game?.room_code || ''}`}
                      size={140}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0f1923"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">扫码直接加入房间</p>
                </div>
                <button onClick={() => setShowRoomCode(false)} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">关闭</button>
              </div>
            </div>
          </div>
        )}

        <main ref={scrollContainerRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
          <div className="flex flex-col gap-4 timeline-line">
            {/* 时间线起始标签 */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700/40" />
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                {game?.created_at ? `${formatTime(game.created_at)} 开局` : '游戏进行中'}
              </span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-700/40" />
            </div>

            {/* 如果是房主，在此插入 幸运手牌待审核 卡片区域 */}
            {isHost && pendingLuckyHits.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-bold flex items-center gap-2 text-yellow-500 mb-2">
                  <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
                  幸运手牌中奖审核
                </h3>
                {pendingLuckyHits.map((hit) => {
                  const isUpdate = hit.request_type === 'update';
                  return (
                    <div key={hit.id} className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                            {hit.users?.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">{hit.users?.username}</div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex items-center mt-1">
                              {isUpdate ? '申请修改手牌' : '申请中奖'}
                              {hit.lucky_hands?.hand_index && <span className="ml-1 text-yellow-500/70">#{hit.lucky_hands.hand_index}</span>}
                              <span className="mx-1">:</span>
                              <div className="flex gap-1">
                                {isUpdate ? (
                                  <HandComboDisp combo={hit.new_card_1 || ''} card2={hit.new_card_2} compact />
                                ) : (
                                  <HandComboDisp combo={hit.lucky_hands?.card_1 || ''} card2={hit.lucky_hands?.card_2} compact />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveLuckyHit(hit.id)} className="flex-1 py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold transition-all shadow-sm">
                          <span className="flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            {isUpdate ? '批准改牌' : '批准中奖'}
                          </span>
                        </button>
                        <button onClick={() => handleRejectLuckyHit(hit.id)} className="px-4 py-2 bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-all">
                          忽略
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 时间线：待审核申请（房主可见）+ 已确认买入/结账记录 合并显示，并按时间升序排列 */}
            {[
              ...pendingRequests.map(r => ({ ...r, _pending: true as const, _time: new Date(r.createdAt).getTime() })),
              ...buyIns.filter(b => b.type === 'checkout' || b.type === 'seat_report' || b.type === 'withdraw' || b.hand_count != null).map(b => ({ ...b, _pending: false as const, _time: new Date(b.created_at).getTime() })),
            ].sort((a, b) => a._time - b._time).map((item) => {
              if (item._pending) {
                const req = item as PendingBuyinEvent & { _pending: true };
                const isMine = req.userId === user?.id;
                // 非房主只能看自己的待审核记录
                if (!isHost && !isMine) return null;
                return (
                  <div key={`p-${req.id}`} className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full border-2 border-dashed border-amber-400/50 dark:border-amber-500/50 overflow-hidden">
                        <Avatar username={req.username || '?'} isAdmin={req.userId === game?.created_by} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background-light dark:ring-background-dark">
                        <span className="material-symbols-outlined text-white text-[10px]">schedule</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 items-start flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide truncate max-w-[120px]">{req.username}</span>
                        {req.userId === game?.created_by && (
                          <span className="text-amber-500 dark:text-amber-400 text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[10px] align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">• {new Date(req.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-dashed border-amber-300 dark:border-amber-600/30 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400/80">{req.type === 'initial' ? '初始买入申请' : '重买申请'}</p>
                            <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">待审核</span>
                          </div>
                          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">${req.amount}</span>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/30">
                            <span className="material-symbols-outlined text-amber-500 dark:text-amber-600 text-[12px]">account_balance_wallet</span>
                            <span className="text-[11px] text-amber-600/70 dark:text-amber-500/70 font-medium">
                              已有总买入: ${buyIns.filter(b => b.user_id === req.userId && (b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw')).reduce((sum, b) => sum + b.amount, 0)}
                            </span>
                          </div>
                          {/* 非房主看到自己的审核状态提示 */}
                          {!isHost && isMine && (
                            <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-800/30">
                              <span className="material-symbols-outlined text-amber-500 text-[12px] animate-spin" style={{ animationDuration: '2s' }}>progress_activity</span>
                              <span className="text-[11px] text-amber-600/70 dark:text-amber-500/70 font-medium">等待房主审核中...</span>
                            </div>
                          )}
                        </div>
                        {/* 房主才有批准/拒绝按钮 */}
                        {isHost && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              onClick={() => setConfirmReq(req)}
                              className="flex items-center gap-1 bg-primary hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-primary/20"
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>批准
                            </button>
                            <button
                              onClick={() => handleReject(req)}
                              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 dark:hover:text-red-400 text-slate-500 text-xs font-bold py-2.5 px-3.5 rounded-xl transition-all duration-200"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>拒绝
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else {
                const b = item as BuyIn & { _pending: false };

                // ── 座位报告条目 ──
                if (b.type === 'seat_report') {
                  return (
                    <div key={b.id} className="flex items-center justify-center py-1">
                      <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/20">
                        <span className="material-symbols-outlined text-[12px] align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>event_seat</span>
                        {b.users?.username || '玩家'} 报座位：{b.amount}号位
                      </span>
                    </div>
                  );
                }

                // ── 结账记录条目 ──
                if (b.type === 'checkout') {
                  const playerTotalBuyin = buyIns
                    .filter(prev => prev.user_id === b.user_id && (prev.type === 'initial' || prev.type === 'rebuy' || prev.type === 'withdraw'))
                    .reduce((sum, prev) => sum + prev.amount, 0);
                  const profit = b.amount - playerTotalBuyin;

                  return (
                    <div key={b.id} className="flex items-start gap-3 group">
                      <div className="relative shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                        onClick={() => setSelectedPlayerStats({ id: b.user_id, username: b.users?.username || '?' })}
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-emerald-400/40 dark:border-emerald-500/40 grayscale-[30%]">
                          <Avatar username={b.users?.username || '?'} isAdmin={b.user_id === game?.created_by} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background-light dark:ring-background-dark">
                          <span className="material-symbols-outlined text-white text-[10px]">check</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 items-start flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide truncate max-w-[120px]">{b.users?.username || '玩家'}</span>
                          {b.user_id === game?.created_by && (
                            <span className="text-amber-500 dark:text-amber-400 text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[10px] align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 dark:text-slate-600">• {formatTime(b.created_at)}</span>
                        </div>
                        <div className="w-full rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800/30">
                          <div className="flex">
                            {/* 左侧 emerald 竖条 */}
                            <div className="w-1 bg-emerald-500 shrink-0" />
                            <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400/80">结账离场</p>
                                <div className="flex items-center gap-1.5">
                                  {b.created_by ? (
                                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded-md">
                                      <span className="material-symbols-outlined text-[10px]">admin_panel_settings</span>
                                      代结
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-400/70 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                      <span className="material-symbols-outlined text-[10px]">person</span>
                                      自结
                                    </span>
                                  )}
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">已结账</span>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-3">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${b.amount}</span>
                                <span className={`text-base font-black ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                  {profit >= 0 ? '+' : ''}{profit}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── 撤码条目 ──
                if (b.type === 'withdraw') {
                  return (
                    <div key={b.id} className="flex items-start gap-3 group">
                      <div className="relative shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                        onClick={() => setSelectedPlayerStats({ id: b.user_id, username: b.users?.username || '?' })}
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-orange-300/40 dark:border-orange-500/40">
                          <Avatar username={b.users?.username || '?'} isAdmin={b.user_id === game?.created_by} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background-light dark:ring-background-dark">
                          <span className="material-symbols-outlined text-white text-[10px]">remove</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 items-start flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide truncate max-w-[120px]">{b.users?.username || '玩家'}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-600">• {formatTime(b.created_at)}</span>
                        </div>
                        <div className="w-full rounded-xl overflow-hidden border border-orange-200 dark:border-orange-800/30">
                          <div className="flex">
                            <div className="w-1 bg-orange-500 shrink-0" />
                            <div className="flex-1 bg-orange-50 dark:bg-orange-950/20 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-orange-500/70" style={{ fontVariationSettings: "'FILL' 1" }}>remove_shopping_cart</span>
                                  <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400/80">撤码</p>
                                </div>
                                {b.created_by ? (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded-md">
                                    <span className="material-symbols-outlined text-[10px]">admin_panel_settings</span>
                                    代撤
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500 dark:text-orange-400/70 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded-md">
                                    <span className="material-symbols-outlined text-[10px]">person</span>
                                    自撤
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-orange-600 dark:text-orange-400">${b.amount}</span>
                                {b.hand_count ? <span className="text-xs font-bold text-orange-400 dark:text-orange-500">({b.hand_count}手)</span> : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── 已确认买入条目 ──
                return (
                  <div key={b.id} className="flex items-start gap-3 group">
                    <div className="relative shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                      onClick={() => setSelectedPlayerStats({ id: b.user_id, username: b.users?.username || '?' })}
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-slate-200 dark:border-slate-700 ring-2 ring-primary/15">
                        <Avatar username={b.users?.username || '?'} isAdmin={b.user_id === game?.created_by} />
                      </div>
                      {b.user_id === game?.created_by && (
                        <div className="absolute -top-1 -right-1 text-amber-500 dark:text-amber-400 drop-shadow-md">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>crown</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 items-start flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide truncate max-w-[120px]">{b.users?.username || '玩家'}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">• {formatTime(b.created_at)}</span>
                      </div>
                      <div className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50">
                        <div className="flex">
                          {/* 左侧 primary 竖条 */}
                          <div className={`w-1 shrink-0 ${b.type === 'initial' ? 'bg-primary' : 'bg-sky-400'}`} />
                          <div className="flex-1 bg-white dark:bg-surface-dark/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-primary/60" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  {b.type === 'initial' ? 'login' : 'add_circle'}
                                </span>
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{b.type === 'initial' ? '初始买入' : '重买/加注'}</p>
                              </div>
                              {b.created_by ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded-md">
                                  <span className="material-symbols-outlined text-[10px]">admin_panel_settings</span>
                                  代买
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-md">
                                  <span className="material-symbols-outlined text-[10px]">person</span>
                                  自购
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-primary">{b.type === 'rebuy' ? '+' : ''}${b.amount}</span>
                              {b.hand_count ? <span className="text-xs font-bold text-slate-400 dark:text-slate-500">({b.hand_count}手)</span> : null}
                            </div>
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/40">
                              <span className="material-symbols-outlined text-slate-400 dark:text-slate-600 text-[12px]">account_balance_wallet</span>
                              <span className="text-[11px] font-medium text-slate-500">累计: ${
                                buyIns
                                  .filter(prev => prev.user_id === b.user_id &&
                                    (prev.type === 'initial' || prev.type === 'rebuy' || prev.type === 'withdraw') &&
                                    new Date(prev.created_at).getTime() <= new Date(b.created_at).getTime())
                                  .reduce((sum, prev) => sum + prev.amount, 0)
                              }</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {buyIns.length === 0 && pendingRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-600" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
                </div>
                <p className="text-slate-500 text-sm font-medium">牌局已开始</p>
                <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">点击下方"买入"加入游戏</p>
              </div>
            )}

            {myTotalBuyIn > 0 && !buyIns.some(b => b.user_id === user?.id && b.type === 'checkout') && (
              <div className="w-full my-2">
                <div className="bg-primary/5 border border-primary/15 rounded-xl py-3 px-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[18px]">account_balance_wallet</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">你的当前总买入</p>
                    <p className="text-lg font-black text-primary">${myTotalBuyIn}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="h-24" />
          </div>
        </main>

        {/* 底部渐变遮罩 + 操作按钮 */}
        <div className="fixed left-0 right-0 z-10 pointer-events-none" style={{ bottom: 0 }}>
          <div className="h-28 bg-gradient-to-t from-background-light via-background-light/80 dark:from-background-dark dark:via-background-dark/80 to-transparent" />
          <div className="absolute left-0 right-0 px-5 flex justify-center gap-3" style={{ bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 8px))' }}>
            <button onClick={() => {
              setShowBuyIn(true);
              setBuyInAmount('1');
            }} className="pointer-events-auto shadow-[0_8px_32px_rgba(19,127,236,0.3)] flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-t from-primary to-[#2b93f7] px-6 py-3.5 text-white transition-all duration-200 active:scale-95 max-w-[200px]">
              <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              <span className="text-base font-black tracking-wide">买入</span>
            </button>
            <button onClick={() => setShowCheckout(true)} className="pointer-events-auto shadow-[0_8px_32px_rgba(16,185,129,0.25)] flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-t from-emerald-600 to-emerald-500 px-6 py-3.5 text-white transition-all duration-200 active:scale-95 max-w-[200px]">
              <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
              <span className="text-base font-black tracking-wide">结账</span>
            </button>
          </div>
        </div>

        {/* Buy-in Modal */}
        {showBuyIn && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setBuyInAmount(''); setShowBuyIn(false); setBuyinSuccess(null); }} />
            <div className="relative w-full sm:max-w-sm overflow-hidden rounded-t-3xl sm:rounded-2xl bg-[#1a2530] shadow-2xl">

              {buyinSuccess ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400 text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <h3 className="text-xl font-black text-white mb-4">买入成功</h3>
                  <div className="flex justify-center gap-6 mb-8">
                    <div className="text-center">
                      <p className="text-[11px] text-slate-500 font-medium mb-1">本次买入</p>
                      <p className="text-xl font-black text-white">${buyinSuccess.amount}</p>
                    </div>
                    <div className="w-px bg-slate-700/60" />
                    <div className="text-center">
                      <p className="text-[11px] text-slate-500 font-medium mb-1">当前总买入</p>
                      <p className="text-xl font-black text-primary">${buyinSuccess.total}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setBuyinSuccess(null); setShowBuyIn(false); }}
                    className="w-full py-3.5 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-all duration-200"
                  >
                    我知道了
                  </button>
                </div>
              ) : (
                <>
                  <div className="px-6 pt-6 pb-4 text-center">
                    <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                    </div>
                    <h3 className="text-lg font-black text-white">按手数买入</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {game ? `每手 $${game.points_per_hand || 100}，单次最多 ${game.max_hands_per_buy || 10} 手` : '请输入买入手数'}
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    <div className="relative">
                      <input autoFocus className="block w-full rounded-xl border-2 border-slate-700/60 bg-slate-900/40 px-4 py-4 text-3xl font-black text-white placeholder-slate-700 focus:border-primary focus:outline-none text-center tracking-wider transition-colors duration-200"
                        inputMode="numeric" placeholder="1" type="number" min="1" max={game?.max_hands_per_buy || 10} value={buyInAmount} onChange={e => setBuyInAmount(e.target.value)} onClick={e => (e.target as HTMLInputElement).select()} />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <span className="text-lg font-bold text-slate-600">手</span>
                      </div>
                    </div>
                    {buyInAmount && parseInt(buyInAmount) > 0 && game && (
                      <p className="text-center text-xl font-black text-primary mt-3">
                        = ${parseInt(buyInAmount) * (game.points_per_hand || 100)}
                      </p>
                    )}
                    <div className="mt-4 flex flex-col gap-2">
                      <p className="text-center text-xs text-slate-500 font-medium">
                        当前总买入: <span className="text-slate-300 font-bold">${myTotalBuyIn}</span>
                      </p>
                      {needsApproval && !isHost && (
                        <p className="text-center text-xs text-amber-400/80 flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">info</span>提交后等待房主批准
                        </p>
                      )}
                    </div>
                    <button onClick={handleBuyInSubmit} disabled={submitting || !buyInAmount}
                      className="w-full mt-5 py-3.5 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20">
                      {submitting ? '处理中...' : (needsApproval && !isHost) ? '提交申请' : '确认买入'}
                    </button>
                    <button onClick={() => { setBuyInAmount(''); setShowBuyIn(false); }}
                      className="w-full mt-2 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors">
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 带入审核确认对话框 */}
        {confirmReq && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !confirming && setConfirmReq(null)} />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#1a2530] shadow-2xl">
              <div className="px-6 pt-6 pb-5 text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">确认批准买入？</h3>
                <div className="inline-flex items-center gap-2 bg-slate-800/60 rounded-xl px-4 py-2.5">
                  <Avatar username={confirmReq.username || '?'} isAdmin={false} className="w-8 h-8" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{confirmReq.username}</p>
                    <p className="text-[11px] text-slate-400">
                      {confirmReq.type === 'initial' ? '初始买入' : '重买'} <span className="text-primary font-black">${confirmReq.amount}</span>
                    </p>
                  </div>
                </div>
                <p className="text-slate-600 text-[11px] mt-3">批准后将同步通知房间内所有用户</p>
              </div>
              <div className="px-6 pb-6 flex flex-col gap-2">
                <button
                  onClick={handleConfirmApprove}
                  disabled={confirming}
                  className="w-full py-3.5 bg-primary hover:bg-blue-500 text-white font-black rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
                >
                  {confirming ? (
                    <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>处理中...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>确认批准</>
                  )}
                </button>
                <button
                  onClick={() => setConfirmReq(null)}
                  disabled={confirming}
                  className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Modal */}

        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setCheckoutChips(''); setShowCheckout(false); }} />
            <div className="relative w-full sm:max-w-sm overflow-hidden rounded-t-3xl sm:rounded-2xl bg-[#1a2530] shadow-2xl">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                </div>
                <h3 className="text-lg font-black text-white">结账离场</h3>
                <p className="mt-1 text-xs text-slate-500">输入你当前的筹码总量</p>
              </div>
              <div className="px-6 pb-6">
                {/* 总买入 vs 筹码 对比 */}
                <div className="flex items-center justify-center gap-4 mb-4 bg-slate-800/40 rounded-xl p-3">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-medium">总买入</p>
                    <p className="text-lg font-black text-slate-300">${myTotalBuyIn}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-600 text-[20px]">arrow_forward</span>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-medium">剩余筹码</p>
                    <p className="text-lg font-black text-emerald-400">{checkoutChips ? `$${checkoutChips}` : '--'}</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="text-2xl font-black text-primary">$</span>
                  </div>
                  <input autoFocus className="block w-full rounded-xl border-2 border-slate-700/60 bg-slate-900/40 pl-10 pr-4 py-4 text-3xl font-black text-white placeholder-slate-700 focus:border-emerald-500 focus:outline-none text-center tracking-wider transition-colors duration-200"
                    inputMode="decimal" placeholder="0" type="number" value={checkoutChips} onChange={e => setCheckoutChips(e.target.value)} onClick={e => (e.target as HTMLInputElement).select()} />
                </div>
                {/* 盈亏预览 */}
                {checkoutChips && (
                  <div className="mt-3 text-center">
                    <p className="text-[11px] text-slate-500 font-medium mb-0.5">预计盈亏</p>
                    <p className={`text-2xl font-black ${parseInt(checkoutChips || '0') - myTotalBuyIn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parseInt(checkoutChips) - myTotalBuyIn >= 0 ? '+' : ''}${parseInt(checkoutChips) - myTotalBuyIn}
                    </p>
                  </div>
                )}
                <button onClick={handleCheckoutSubmit} disabled={submitting || !checkoutChips}
                  className="w-full mt-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
                  {submitting ? '处理中...' : '提交结算'}
                </button>
                <button onClick={() => { setCheckoutChips(''); setShowCheckout(false); }}
                  className="w-full mt-2 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors">
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 浮层与模态框挂载区 --- */}

        {/* #26 自定义修改手牌确认 Modal（替代 window.confirm） */}
        {modifyConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-[#1e2936] rounded-2xl max-w-sm w-full p-6 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-900/30 text-amber-500 mb-4 mx-auto">
                <span className="material-symbols-outlined text-[28px]">edit_note</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-center text-white">确定修改手牌？</h3>
              <p className="text-slate-400 text-sm mb-4 text-center leading-relaxed">
                新卡牌将即时生效，同时该组中奖次数将重置为 0。
              </p>
              <div className="flex justify-center mb-6">
                <HandComboDisp combo={modifyConfirm.card1} card2={modifyConfirm.card2} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModifyConfirm(null)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    const { card1, card2 } = modifyConfirm;
                    setModifyConfirm(null);
                    try {
                      setLuckyHands(prev => prev.map(h => h.hand_index === targetHandIndex ? { ...h, card_1: card1, card_2: card2, hit_count: 0 } : h));
                      await luckyHandsApi.setup(id!, user!.id, targetHandIndex, card1, card2);
                      showToast("您的手牌修改成功", 'success');
                    } catch (err) {
                      console.error(err);
                      showToast("修改失败", 'error');
                    }
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                >
                  确认修改
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 房主免审确认 Dialog */}
        {directHitConfirmHand && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-[#1e2936] rounded-2xl max-w-sm w-full p-6 shadow-2xl ring-1 ring-white/10 animate-in zoom-in duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-900/30 text-yellow-500 mb-4 mx-auto">
                <span className="material-symbols-outlined text-[28px]">workspace_premium</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-center text-white">确认自己中奖？</h3>
              <p className="text-slate-400 text-sm mb-6 text-center leading-relaxed">
                房主特权：无需审核，直接为您增加该手牌组的中奖次数。
              </p>
              <div className="flex justify-center mb-6">
                <HandComboDisp combo={directHitConfirmHand.card_1} card2={directHitConfirmHand.card_2} />
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setDirectHitConfirmHand(null)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold transition-colors"
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      setLuckyHands(prev => prev.map(h => h.hand_index === directHitConfirmHand.hand_index ? { ...h, hit_count: h.hit_count + 1 } : h));
                      await luckyHandsApi.hostDirectHit(id!, user!.id, (directHitConfirmHand as LuckyHandData & { id: string }).id);
                      setDirectHitConfirmHand(null);
                    } catch (e) {
                      showToast('免审通过失败', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold shadow-lg shadow-yellow-500/30 transition-all active:scale-95"
                  disabled={submitting}
                >
                  {submitting ? '处理中...' : '确认中奖'}
                </button>
              </div>
            </div>
          </div>
        )}

        {game?.lucky_hands_count > 0 && user && (
          <LuckyHandFAB
            maxHandsCount={game.lucky_hands_count}
            configuredHands={luckyHands}
            onSelectSlot={handleSelectSlot}
            onLongPressMain={() => setShowTVDashboard(true)}
          />
        )}

        <LuckyHandsTVDashboard
          isOpen={showTVDashboard}
          onClose={() => setShowTVDashboard(false)}
          players={players}
          allLuckyHands={allLuckyHands}
          luckyHandsCount={game?.lucky_hands_count || 0}
        />

        <CardSelectorModal
          isOpen={isCardSelectorOpen}
          onClose={() => setIsCardSelectorOpen(false)}
          onConfirm={handleConfirmCardSelection}
          targetHandIndex={targetHandIndex}
        />

        {/* 点击头像查看该玩家的大盘 */}
        {selectedPlayerStats && game?.lucky_hands_count !== undefined && ( // 4. 在浮层区域挂载 PlayerStatsModal 组件
          <PlayerStatsModal
            isOpen={true}
            onClose={() => setSelectedPlayerStats(null)}
            gameId={id!}
            userId={selectedPlayerStats.id}
            username={selectedPlayerStats.username}
            luckyHandsCount={game.lucky_hands_count}
            onModifyLuckyHand={handleModifyLuckyHandFromStats}
            currentUserId={user?.id}
            isHost={isHost}
            hasCheckedOut={buyIns.some(b => b.user_id === selectedPlayerStats.id && b.type === 'checkout')}
            onProxyBuyIn={handleProxyBuyIn}
            onProxyCheckout={handleProxyCheckout}
            onKickPlayer={handleKickPlayer}
          />
        )}

        {/* 幸运手牌命中 — 全屏庆祝动画 */}
        {celebrationData && (
          <LuckyHandCelebration
            combo={celebrationData.combo}
            username={celebrationData.username}
            hitCount={celebrationData.hitCount}
            onComplete={() => setCelebrationData(null)}
          />
        )}

        {/* 长按头像 — 趣味交互弹窗 */}
        {actionPopupTarget && (() => {
          const targetIsSelf = actionPopupTarget.userId === user?.id;
          // 自己或房主可以撤码；目标玩家需有未结账的买入手数
          const targetBuyIns = buyIns.filter(b => b.user_id === actionPopupTarget.userId);
          const hasCheckedOut = targetBuyIns.some(b => b.type === 'checkout');
          const totalBuyHands = targetBuyIns.filter(b => b.type === 'initial' || b.type === 'rebuy').reduce((s, b) => s + (b.hand_count || 0), 0);
          const totalWithdrawHands = targetBuyIns.filter(b => b.type === 'withdraw').reduce((s, b) => s + (b.hand_count || 0), 0);
          const availableHands = totalBuyHands - totalWithdrawHands;
          const canWithdraw = !hasCheckedOut && availableHands > 0 && (targetIsSelf || isHost);
          return (
            <PlayerActionPopup
              target={actionPopupTarget}
              onClose={() => setActionPopupTarget(null)}
              onStartTimer={handleStartTimer}
              onThrowEgg={handleThrowEgg}
              onCatchChicken={handleCatchChicken}
              onSendFlower={handleSendFlower}
              onWithdraw={handleWithdraw}
              isSelf={targetIsSelf}
              canWithdraw={canWithdraw}
            />
          );
        })()}

        {/* 房主代操作弹窗 */}
        {proxyTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setProxyTarget(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[300px] rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${proxyTarget.action === 'buyin' ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                  <span className={`material-symbols-outlined text-[28px] ${proxyTarget.action === 'buyin' ? 'text-primary' : 'text-green-500'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {proxyTarget.action === 'buyin' ? 'payments' : 'receipt_long'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {proxyTarget.action === 'buyin' ? '代购买' : '代结账'}
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  为 <span className="font-bold text-slate-200">{proxyTarget.username}</span> {proxyTarget.action === 'buyin' ? '按手数购买' : '结账'}
                </p>
                <div className="relative w-full">
                  <input
                    type="number"
                    value={proxyAmount}
                    onChange={e => setProxyAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !proxySubmitting) handleProxySubmit(); }}
                    onClick={e => (e.target as HTMLInputElement).select()}
                    autoFocus
                    className="w-full rounded-xl border-2 border-slate-700 bg-slate-900/50 px-4 py-4 text-3xl font-bold text-white placeholder-slate-600 focus:border-primary focus:outline-none text-center tracking-wider"
                    placeholder={proxyTarget.action === 'buyin' ? '1' : '0'}
                    min={proxyTarget.action === 'buyin' ? 1 : 0}
                    max={proxyTarget.action === 'buyin' ? (game?.max_hands_per_buy || 10) : undefined}
                    inputMode="numeric"
                  />
                  {proxyTarget.action === 'buyin' && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <span className="text-lg font-bold text-slate-500">手</span>
                    </div>
                  )}
                </div>
                {proxyTarget.action === 'buyin' && proxyAmount && parseInt(proxyAmount) > 0 && game && (
                  <p className="text-center text-sm font-bold text-primary mt-2">
                    = ${parseInt(proxyAmount) * (game.points_per_hand || 100)}
                  </p>
                )}
              </div>
              <div className="flex border-t border-slate-700">
                <button
                  onClick={() => setProxyTarget(null)}
                  disabled={proxySubmitting}
                  className="flex-1 py-3.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <div className="w-px bg-slate-700" />
                <button
                  onClick={handleProxySubmit}
                  disabled={proxySubmitting || !proxyAmount}
                  className={`flex-1 py-3.5 text-sm font-bold transition-colors disabled:opacity-50 ${proxyTarget.action === 'buyin' ? 'text-primary hover:bg-primary/5' : 'text-green-500 hover:bg-green-950/20'}`}
                >
                  {proxySubmitting ? '提交中...' : '确认'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 踢人确认弹窗 */}
        {kickConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setKickConfirm(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[300px] rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-red-500/10">
                  <span className="material-symbols-outlined text-[28px] text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>person_remove</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">确认移出</h3>
                <p className="text-sm text-slate-400">
                  将 <span className="font-bold text-slate-200">{kickConfirm.username}</span> 移出房间？
                </p>
                <p className="text-xs text-slate-500 mt-2">移出后该玩家将从头像栏消失，有效买入记录会保留在时间线</p>
              </div>
              <div className="flex border-t border-slate-700">
                <button
                  onClick={() => setKickConfirm(null)}
                  disabled={kicking}
                  className="flex-1 py-3.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <div className="w-px bg-slate-700" />
                <button
                  onClick={handleKickConfirm}
                  disabled={kicking}
                  className="flex-1 py-3.5 text-sm font-bold text-red-500 hover:bg-red-950/20 transition-colors disabled:opacity-50"
                >
                  {kicking ? '处理中...' : '确认移出'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 撤码弹窗 */}
        {withdrawTarget && (() => {
          const targetBuyIns = buyIns.filter(b => b.user_id === withdrawTarget.userId);
          const totalBuyHands = targetBuyIns.filter(b => b.type === 'initial' || b.type === 'rebuy').reduce((s, b) => s + (b.hand_count || 0), 0);
          const totalWithdrawHands = targetBuyIns.filter(b => b.type === 'withdraw').reduce((s, b) => s + (b.hand_count || 0), 0);
          const availableHands = totalBuyHands - totalWithdrawHands;
          const pph = game?.points_per_hand || 100;
          const isSelfWithdraw = withdrawTarget.userId === user?.id;
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setWithdrawTarget(null)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className="relative w-full max-w-[300px] rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center px-6 pt-7 pb-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-orange-500/10">
                    <span className="material-symbols-outlined text-[28px] text-orange-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                      remove_shopping_cart
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">撤码</h3>
                  <p className="text-sm text-slate-400 mb-1">
                    {isSelfWithdraw ? '按手数撤回积分' : <>为 <span className="font-bold text-slate-200">{withdrawTarget.username}</span> 撤码</>}
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    可撤 <span className="font-bold text-orange-400">{availableHands}</span> 手（已买 {totalBuyHands} 手，已撤 {totalWithdrawHands} 手）
                  </p>
                  <div className="relative w-full">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !withdrawSubmitting) handleWithdrawSubmit(); }}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      autoFocus
                      className="w-full rounded-xl border-2 border-slate-700 bg-slate-900/50 px-4 py-4 text-3xl font-bold text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none text-center tracking-wider"
                      placeholder="1"
                      min={1}
                      max={availableHands}
                      inputMode="numeric"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <span className="text-lg font-bold text-slate-500">手</span>
                    </div>
                  </div>
                  {withdrawAmount && parseInt(withdrawAmount) > 0 && (
                    <p className="text-center text-sm font-bold text-orange-500 mt-2">
                      = -${parseInt(withdrawAmount) * pph}
                    </p>
                  )}
                </div>
                <div className="flex border-t border-slate-700">
                  <button
                    onClick={() => setWithdrawTarget(null)}
                    disabled={withdrawSubmitting}
                    className="flex-1 py-3.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <div className="w-px bg-slate-700" />
                  <button
                    onClick={handleWithdrawSubmit}
                    disabled={withdrawSubmitting || !withdrawAmount}
                    className="flex-1 py-3.5 text-sm font-bold text-orange-500 hover:bg-orange-950/20 transition-colors disabled:opacity-50"
                  >
                    {withdrawSubmitting ? '提交中...' : '确认撤码'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 思考计时器覆盖层 — 主持模式（发起者） */}
        {shameTimerTarget && user && (
          <ShameTimerOverlay
            targetUsername={shameTimerTarget.username}
            targetUserId={shameTimerTarget.userId}
            startedByUsername={user.username}
            currentUserId={user.id}
            startedByUserId={user.id}
            onStop={handleStopTimer}
            onCancel={handleCancelTimer}
            onTimerStarted={handleTimerStarted}
          />
        )}

        {/* 思考计时器覆盖层 — 观看模式（广播来的） */}
        {viewingTimer && activeTimer && user && (
          <ShameTimerOverlay
            targetUsername={activeTimer.targetUsername}
            targetUserId={activeTimer.targetUserId}
            startedByUsername={activeTimer.startedByUsername}
            currentUserId={user.id}
            startedByUserId={activeTimer.startedBy}
            onStop={() => {}}
            onCancel={() => setViewingTimer(false)}
            viewerMode
            viewerStartedAt={activeTimer.startedAt}
            viewerTotalSeconds={activeTimer.totalSeconds}
          />
        )}

        {/* 扔鸡蛋动画 */}
        {eggTarget && (
          <EggThrowAnimation
            targetUsername={eggTarget.username}
            targetRect={eggTarget.rect}
            onComplete={() => setEggTarget(null)}
          />
        )}

        {/* 抓鸡动画 */}
        {chickenTarget && (
          <ChickenCatchAnimation
            targetUsername={chickenTarget.username}
            targetRect={chickenTarget.rect}
            onComplete={() => setChickenTarget(null)}
          />
        )}

        {/* 送鲜花动画 */}
        {flowerTarget && (
          <FlowerAnimation
            targetUsername={flowerTarget.username}
            targetRect={flowerTarget.rect}
            onComplete={() => setFlowerTarget(null)}
          />
        )}
      </div>
    </AnimatedPage>
  );
}
