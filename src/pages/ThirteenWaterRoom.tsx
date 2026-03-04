import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { gamesApi, Game, Player } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';

// 导入拆分后的组件
import {
  SPECIAL_HAND_NAMES,
  RoundState, HandState, GameState, SettlementPlayer, RoundResult, TableProps,
  ScoreBoard,
} from './thirteen/shared';
import { TwoPlayerTable } from './thirteen/TwoPlayerTable';
import { ThreePlayerTable } from './thirteen/ThreePlayerTable';
import { FourPlayerTable } from './thirteen/FourPlayerTable';

interface ThirteenWaterRoomProps {
  forcedId: string;
}

// ─── 模块级常量 ─────────────────────────────────────────────────
const LANE_MAX = { head: 3, mid: 5, tail: 5 } as const;

// ─── Header 组件（提取到函数体外避免每次渲染重建） ────────────────

const RoomHeader = memo<{
  game: Game | null;
  finishedRounds: number;
  gamePhase: string;
  onBack: () => void;
  onShowScoreBoard: () => void;
  showBack?: boolean;
}>(function RoomHeader({ game, finishedRounds, gamePhase, onBack, onShowScoreBoard, showBack = true }) { return (
  <div className="flex items-center px-4 h-14 border-b border-white/5 shrink-0">
    {showBack && (
      <button onClick={onBack} className="mr-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <span className="material-symbols-outlined text-[22px] text-white">arrow_back</span>
      </button>
    )}
    <div className="flex-1 min-w-0">
      <h1 className="text-base font-bold truncate text-white">{game?.name}</h1>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">十三水</span>
        <span>底分{game?.thirteen_base_score || 1}</span>
        <span>·</span>
        <span>{game?.thirteen_ghost_count || 6}鬼</span>
        {finishedRounds > 0 && <span>· 第{finishedRounds + (gamePhase !== 'waiting' ? 1 : 0)}局</span>}
      </div>
    </div>
    <div className="flex items-center gap-1">
      <button onClick={onShowScoreBoard} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="积分账单">
        <span className="material-symbols-outlined text-[20px] text-slate-400">receipt_long</span>
      </button>
      <span className="text-[10px] font-mono text-slate-500">{game?.room_code}</span>
    </div>
  </div>
); });

// ─── 主组件 ────────────────────────────────────────────────────

export default function ThirteenWaterRoom({ forcedId }: ThirteenWaterRoomProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const id = forcedId;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);

  // 游戏状态
  const [gamePhase, setGamePhase] = useState<'waiting' | 'arranging' | 'revealing' | 'settled'>('waiting');
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);

  // 当前玩家的手牌
  const [myHeadCards, setMyHeadCards] = useState<string[]>([]);
  const [myMidCards, setMyMidCards] = useState<string[]>([]);
  const [myTailCards, setMyTailCards] = useState<string[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // 对手确认状态
  const [confirmedUsers, setConfirmedUsers] = useState<Record<string, boolean>>({});

  // 公共牌 & 鬼牌
  const [publicCards, setPublicCards] = useState<string[]>([]);
  const [ghostCount, setGhostCount] = useState(0);

  // 累计总分
  const [playerTotals, setPlayerTotals] = useState<Record<string, number>>({});
  const [finishedRounds, setFinishedRounds] = useState(0);

  // 结算结果
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isAutoArranging, setIsAutoArranging] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const settlingRef = useRef(false);

  // 弹层
  const [showPicker, setShowPicker] = useState(false);
  const [activeLane, setActiveLane] = useState<'head' | 'mid' | 'tail'>('head');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showScoreBoard, setShowScoreBoard] = useState(false);
  const [showGhostPicker, setShowGhostPicker] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCompare, _setShowCompare] = useState(false);
  const setShowCompare = useCallback((v: boolean) => { showCompareRef.current = v; _setShowCompare(v); }, []);

  // 密码门禁 & 旁观模式
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordPin, setPasswordPin] = useState<string[]>(['', '', '', '', '', '']);
  const [passwordError, setPasswordError] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  // 同名互踢
  const sessionIdRef = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const showCompareRef = useRef(false);

  const showToast = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isHost = user?.id === game?.created_by;
  const maxPlayers = game?.thirteen_max_players || 4;
  const currentPlayers = players.length;

  // ─── 获取游戏基础数据 ───────────────────────────────────────
  const fetchGame = useCallback(async () => {
    if (!id) return;
    try {
      const res = await gamesApi.get(id);
      setGame(res.game);
      setPlayers(res.players);
      return res;
    } catch {
      showToast('加载房间失败', 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // ─── 获取游戏进度并同步 ─────────────────────────────────────
  const syncGameState = useCallback(async () => {
    if (!id || !user) return;
    try {
      const res = await fetch(`/api/thirteen/${id}/state?_t=${Date.now()}`);
      if (!res.ok) return;
      const state: GameState = await res.json();

      setPlayerTotals(state.playerTotals || {});
      setFinishedRounds(state.finishedRounds || 0);
      const stateTotalPlayers = state.totalPlayers || 0;
      console.log('[syncGameState] state:', {
        activeRound: state.activeRound?.id, status: state.activeRound?.status,
        totalPlayers: stateTotalPlayers, handsCount: state.hands.length,
      });

      if (state.activeRound) {
        const round = state.activeRound;
        setCurrentRoundId(round.id);
        setPublicCards(round.public_cards || []);
        setGhostCount(round.ghost_count || 0);

        const confirmed: Record<string, boolean> = {};
        for (const h of state.hands) {
          if (h.is_confirmed) confirmed[h.user_id] = true;
        }
        setConfirmedUsers(confirmed);

        const myHand = state.hands.find(h => h.user_id === user.id);
        if (myHand) {
          if (myHand.head_cards?.length) setMyHeadCards(myHand.head_cards);
          if (myHand.mid_cards?.length) setMyMidCards(myHand.mid_cards);
          if (myHand.tail_cards?.length) setMyTailCards(myHand.tail_cards);
          setIsConfirmed(myHand.is_confirmed);
        }

        // 判断是否需要进入结算流程（finished 不再触发，结算完成即回到等待状态）
        const needsSettle =
          round.status === 'settling' ||
          (round.status === 'arranging' && stateTotalPlayers >= 2 && Object.keys(confirmed).length >= stateTotalPlayers);

        console.log('[syncGameState] needsSettle=', needsSettle, {
          status: round.status, stateTotalPlayers, confirmed: Object.keys(confirmed).length,
          settlingRef: settlingRef.current,
        });

        if (needsSettle) {
          setGamePhase('arranging');
          if (!settlingRef.current) {
            settlingRef.current = true;
            try {
              // 尝试调 /settle（未结算→执行, 已结算→返回结果, settling→恢复）
              let settlement: any = null;
              try {
                const settleRes = await fetch(`/api/thirteen/${id}/settle`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id, roundId: round.id }),
                });
                const settleData = await settleRes.json();
                if (settleRes.ok && settleData.settlement) {
                  settlement = settleData.settlement;
                }
              } catch (err) { console.error('[syncGameState] /settle 请求失败:', err); }

              // 如果 /settle 没返回结果（可能后端旧版还在报错），直接查轮次详情
              if (!settlement) {
                const detailRes3 = await fetch(`/api/thirteen/${id}/round/${round.id}?_t=${Date.now()}`);
                const detailData3 = await detailRes3.json();
                if (detailData3.totals?.length > 0) {
                  settlement = {
                    players: (detailData3.totals || []).map((t: any) => ({
                      userId: t.user_id, rawScore: t.raw_score, finalScore: t.final_score,
                      gunsFired: t.guns_fired, homerun: t.homerun,
                      laneScores: (detailData3.scores || []).filter((s: any) => s.user_id === t.user_id).map((s: any) => ({
                        lane: s.lane, userId: s.user_id, opponentId: s.opponent_id, score: s.score, detail: s.detail,
                      })),
                    })),
                  };
                }
              }

              // 有结算结果 → 显示比牌动画
              if (settlement) {
                const detailRes2 = await fetch(`/api/thirteen/${id}/round/${round.id}?_t=${Date.now()}`);
                const detailData2 = await detailRes2.json();
                setRoundResult({
                  settlement,
                  hands: detailData2.hands || [],
                  publicCards: detailData2.round?.public_cards || [],
                  ghostCount: detailData2.round?.ghost_count || 0,
                  ghostMultiplier: detailData2.round?.ghost_multiplier || 1,
                  roundNumber: detailData2.round?.round_number || 0,
                });
                setShowCompare(true);
              }
            } catch (err) { console.error('[syncGameState] 结算流程异常:', err); }
            finally { settlingRef.current = false; }
          }
        } else if (round.status === 'arranging') {
          setGamePhase('arranging');
        } else if (round.status === 'revealing') {
          setGamePhase('revealing');
        }
      } else {
        setGamePhase('waiting');
        setCurrentRoundId(null);
        setPublicCards([]);
        setGhostCount(0);
        setConfirmedUsers({});
        setMyHeadCards([]);
        setMyMidCards([]);
        setMyTailCards([]);
        setIsConfirmed(false);
      }
    } catch (err) { console.error('[syncGameState] 顶层异常:', err); }
  }, [id, user]);

  // ─── 进入房间: 检查是否已在房间，不在则要求输入密码 ────────
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const res = await fetchGame();
      if (cancelled || !res) return;

      const alreadyIn = res.players.some((p: Player) => p.user_id === user.id);
      if (!alreadyIn) {
        // 首次进入需要密码验证
        setNeedsPassword(true);
        setIsSyncing(false);
        return;
      }
      if (!cancelled) {
        await syncGameState();
        if (!cancelled) setIsSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  // 公共牌变更时，移除玩家手中与公共牌冲突的牌
  useEffect(() => {
    if (publicCards.length === 0) return;
    const pubSet = new Set(publicCards);
    setMyHeadCards(prev => prev.filter(c => !pubSet.has(c)));
    setMyMidCards(prev => prev.filter(c => !pubSet.has(c)));
    setMyTailCards(prev => prev.filter(c => !pubSet.has(c)));
  }, [publicCards]);

  // ─── 结算函数（支持外部传入 roundId，避免闭包陷阱） ──────────
  const doSettle = useCallback(async (overrideRoundId?: string) => {
    const roundId = overrideRoundId || currentRoundId;
    if (!game || !user || !roundId) {
      console.warn('[doSettle] 跳过: game=', !!game, 'user=', !!user, 'roundId=', roundId);
      return;
    }
    if (settlingRef.current) {
      console.warn('[doSettle] 跳过: 已在结算中');
      return;
    }
    settlingRef.current = true;
    setIsSettling(true);
    console.log('[doSettle] 开始结算, roundId=', roundId);
    try {
      let settlement: any = null;

      // 尝试调 /settle
      try {
        const res = await fetch(`/api/thirteen/${game.id}/settle`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, roundId }),
        });
        const data = await res.json();
        console.log('[doSettle] /settle 响应:', res.status, JSON.stringify(data).slice(0, 200));
        if (res.ok && data.settlement) {
          settlement = data.settlement;
        } else if (!res.ok) {
          console.error('[doSettle] /settle 返回错误:', res.status, data.error, data.detail);
          showToast(data.error || `结算失败(${res.status})`, 'error');
        } else if (res.ok && !data.settlement) {
          console.warn('[doSettle] /settle 200但无结果:', JSON.stringify(data));
        }
      } catch (err) { console.error('[doSettle] /settle 请求失败:', err); showToast('结算请求失败', 'error'); }

      // /settle 没返回结果时，直接查轮次详情（兜底）
      if (!settlement) {
        console.log('[doSettle] /settle 无结果，尝试兜底查询...');
        const fallbackRes = await fetch(`/api/thirteen/${game.id}/round/${roundId}?_t=${Date.now()}`);
        const fallbackData = await fallbackRes.json();
        if (fallbackData.totals?.length > 0) {
          settlement = {
            players: (fallbackData.totals || []).map((t: any) => ({
              userId: t.user_id, rawScore: t.raw_score, finalScore: t.final_score,
              gunsFired: t.guns_fired, homerun: t.homerun,
              laneScores: (fallbackData.scores || []).filter((s: any) => s.user_id === t.user_id).map((s: any) => ({
                lane: s.lane, userId: s.user_id, opponentId: s.opponent_id, score: s.score, detail: s.detail,
              })),
            })),
          };
          console.log('[doSettle] 兜底查询成功, players=', settlement.players.length);
        } else {
          console.warn('[doSettle] 兜底查询也无结果');
        }
      }

      if (!settlement) return;

      const detailRes = await fetch(`/api/thirteen/${game.id}/round/${roundId}?_t=${Date.now()}`);
      const detailData = await detailRes.json();

      setRoundResult({
        settlement,
        hands: detailData.hands || [],
        publicCards: detailData.round?.public_cards || [],
        ghostCount: detailData.round?.ghost_count || 0,
        ghostMultiplier: detailData.round?.ghost_multiplier || 1,
        roundNumber: detailData.round?.round_number || 0,
      });
      setShowCompare(true);
      console.log('[doSettle] 结算完成，显示比牌动画');
    } catch (err) { console.error('[doSettle] 结算异常:', err); showToast('网络错误', 'error'); }
    finally { setIsSettling(false); settlingRef.current = false; }
  }, [game, user, currentRoundId]);

  // ─── Supabase Realtime ──────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;

    const channel = supabase.channel(`thirteen-room:${id}`, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'session-claim' }, (payload) => {
        const msg = payload.payload as { userId: string; sessionId: string };
        if (msg.userId === user.id && msg.sessionId !== sessionIdRef.current) {
          showToast('该账号已在其他设备登录，即将退出', 'error');
          setTimeout(() => navigate('/lobby'), 2000);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thirteen_rounds', filter: `game_id=eq.${id}` },
        (payload) => {
          const round = payload.new as RoundState;
          setCurrentRoundId(round.id);
          setPublicCards(round.public_cards || []);
          setGhostCount(round.ghost_count || 0);
          setGamePhase('arranging');
          setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
          setIsConfirmed(false);
          setConfirmedUsers({});
          settlingRef.current = false;
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'thirteen_rounds', filter: `game_id=eq.${id}` },
        (payload) => {
          const round = payload.new as RoundState;
          setPublicCards(round.public_cards || []);
          setGhostCount(round.ghost_count || 0);
          if (round.status === 'finished') {
             if (!showCompareRef.current && !settlingRef.current) {
              (async () => {
                try {
                  const detailRes = await fetch(`/api/thirteen/${id}/round/${round.id}?_t=${Date.now()}`);
                  const detailData = await detailRes.json();
                  const settlementPlayers: SettlementPlayer[] = (detailData.totals || []).map((t: any) => ({
                    userId: t.user_id, rawScore: t.raw_score, finalScore: t.final_score,
                    gunsFired: t.guns_fired, homerun: t.homerun,
                    laneScores: (detailData.scores || []).filter((s: any) => s.user_id === t.user_id).map((s: any) => ({
                      lane: s.lane, userId: s.user_id, opponentId: s.opponent_id, score: s.score, detail: s.detail,
                    })),
                  }));
                  setRoundResult({
                    settlement: { players: settlementPlayers },
                    hands: detailData.hands || [],
                    publicCards: round.public_cards || [],
                    ghostCount: round.ghost_count || 0,
                    ghostMultiplier: round.ghost_multiplier || 1,
                    roundNumber: round.round_number || 0,
                  });
                  setShowCompare(true);
                } catch (err) { console.error('[Realtime] round finished 处理异常:', err); }
              })();
            }
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thirteen_hands' },
        (payload) => {
          const hand = payload.new as HandState;
          if (!hand) return;
          console.log('[Realtime] thirteen_hands 事件:', payload.eventType, 'user=', hand.user_id, 'confirmed=', hand.is_confirmed, 'round=', hand.round_id);
          if (hand.is_confirmed) {
            setConfirmedUsers(prev => {
              const next = { ...prev, [hand.user_id]: true };
              console.log('[Realtime] confirmedUsers 更新:', Object.keys(next).length, '/', '(players.length待检查)');
              return next;
            });
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` },
        () => { fetchGame(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        (payload) => {
          const g = payload.new as { status: string };
          if (g.status === 'finished') {
            showToast('房间已关闭', 'info');
            setTimeout(() => navigate('/lobby'), 1500);
          }
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'session-claim',
            payload: { userId: user.id, sessionId: sessionIdRef.current },
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [id, user, fetchGame, navigate]);

  // ─── 全员确认后自动结算 ─────────────────────────────────────
  useEffect(() => {
    const confirmedCount = Object.keys(confirmedUsers).length;
    console.log('[useEffect autoSettle] gamePhase=', gamePhase, 'confirmed=', confirmedCount, 'currentPlayers=', currentPlayers, 'settling=', settlingRef.current, 'roundId=', currentRoundId);
    if (gamePhase === 'arranging' && confirmedCount >= currentPlayers && currentPlayers >= 2 && !settlingRef.current) {
      console.log('[useEffect autoSettle] 触发自动结算!');
      doSettle(currentRoundId || undefined);
    }
  }, [confirmedUsers, currentPlayers, gamePhase, doSettle, currentRoundId]);

  // ─── 操作 ──────────────────────────────────────────────────
  const handleStartRound = useCallback(async () => {
    if (!game || !user || isStarting) return;
    setIsStarting(true);
    try {
      const res = await fetch(`/api/thirteen/${game.id}/start-round`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.error || '开始失败', 'error');
    } catch { showToast('网络错误', 'error'); }
    finally { setIsStarting(false); }
  }, [game, user, isStarting, showToast]);

  const handleSetPublicCards = useCallback(async (cards: string[]) => {
    if (!game || !user || !currentRoundId) return;
    try {
      const res = await fetch(`/api/thirteen/${game.id}/set-public-cards`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, roundId: currentRoundId, publicCards: cards }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '设置失败', 'error'); return; }
      const round = data.round;
      setPublicCards(round.public_cards || cards);
      setGhostCount(round.ghost_count || 0);
      setShowGhostPicker(false);
      const gc = round.ghost_count || 0;
      if (cards.length === 0) {
        showToast('已清除公共牌', 'info');
      } else {
        showToast(`公共牌已设置: ${cards.length}张${gc > 0 ? `，含${gc}鬼(${Math.pow(2, gc)}倍)` : ''}`, 'success');
      }
    } catch { showToast('网络错误', 'error'); }
  }, [game, user, currentRoundId, showToast]);

  const handleSubmitHand = useCallback(async () => {
    if (!game || !user || !currentRoundId || isSubmitting) return;
    const totalCards = myHeadCards.length + myMidCards.length + myTailCards.length;
    if (totalCards === 0) {
      showToast('请至少选1张牌', 'error'); return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/thirteen/${game.id}/submit-hand`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, roundId: currentRoundId,
          headCards: myHeadCards, midCards: myMidCards, tailCards: myTailCards,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '提交失败', 'error'); return; }
      setIsConfirmed(true);
      setConfirmedUsers(prev => ({ ...prev, [user.id]: true }));
      if (data.isFoul) showToast('注意：你的摆牌被判定为乌龙！', 'error');
      else if (data.specialHand) showToast(`报到牌型: ${SPECIAL_HAND_NAMES[data.specialHand] || data.specialHand}!`, 'success');
      else showToast('已确认摆牌', 'success');
      // 如果 API 告知全员已确认，直接触发结算（传入 roundId 避免闭包问题）
      if (data.allConfirmed) {
        console.log('[handleSubmitHand] 全员已确认, 直接触发结算, roundId=', currentRoundId);
        doSettle(currentRoundId || undefined);
      }
    } catch { showToast('网络错误', 'error'); }
    finally { setIsSubmitting(false); }
  }, [game, user, currentRoundId, isSubmitting, myHeadCards, myMidCards, myTailCards, showToast, doSettle]);

  const handleCloseRoom = useCallback(() => {
    if (!game || !user) return;
    setShowCloseConfirm(true);
  }, [game, user]);

  const handleCloseRoomConfirm = useCallback(async () => {
    if (!game || !user) return;
    setShowCloseConfirm(false);
    try {
      await gamesApi.finish(game.id, user.id);
      showToast('房间已关闭', 'success');
      setTimeout(() => navigate('/lobby'), 1000);
    } catch { showToast('关闭失败', 'error'); }
  }, [game, user, navigate, showToast]);

  const handleForceSettle = useCallback(() => {
    console.log('[handleForceSettle] 手动强制结算, roundId=', currentRoundId);
    settlingRef.current = false; // 重置 ref，允许重试
    doSettle(currentRoundId || undefined);
  }, [currentRoundId, doSettle]);

  const handleCompareClose = useCallback(() => {
    setShowCompare(false);
    setRoundResult(null);
    setGamePhase('waiting');
    setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
    setIsConfirmed(false);
    setConfirmedUsers({});
    setPublicCards([]);
    setGhostCount(0);
    settlingRef.current = false;
    syncGameState();
  }, [syncGameState]);

  const allSelectedCards = useMemo(() => [...myHeadCards, ...myMidCards, ...myTailCards], [myHeadCards, myMidCards, myTailCards]);

  const handleSelectCard = useCallback((card: string) => {
    const laneCards = activeLane === 'head' ? myHeadCards : activeLane === 'mid' ? myMidCards : myTailCards;
    if (laneCards.length >= LANE_MAX[activeLane]) return;
    if (allSelectedCards.includes(card)) return;
    if (publicCards.includes(card)) return;
    if (activeLane === 'head') setMyHeadCards(prev => [...prev, card]);
    else if (activeLane === 'mid') setMyMidCards(prev => [...prev, card]);
    else setMyTailCards(prev => [...prev, card]);
  }, [activeLane, myHeadCards, myMidCards, myTailCards, allSelectedCards, publicCards]);

  const handleRemoveCard = useCallback((card: string) => {
    setMyHeadCards(prev => prev.filter(c => c !== card));
    setMyMidCards(prev => prev.filter(c => c !== card));
    setMyTailCards(prev => prev.filter(c => c !== card));
    setSelectedCard(null);
  }, []);

  // 点击已摆好的牌：选中 / 交换
  const handleCardTap = useCallback((card: string) => {
    if (isConfirmed) return;
    if (!selectedCard) {
      // 没有选中牌 → 选中当前牌
      setSelectedCard(card);
      return;
    }
    if (selectedCard === card) {
      // 点击同一张 → 取消选中
      setSelectedCard(null);
      return;
    }
    // 两张不同牌 → 交换位置
    const findLane = (c: string): 'head' | 'mid' | 'tail' | null => {
      if (myHeadCards.includes(c)) return 'head';
      if (myMidCards.includes(c)) return 'mid';
      if (myTailCards.includes(c)) return 'tail';
      return null;
    };
    const laneA = findLane(selectedCard);
    const laneB = findLane(card);
    if (!laneA || !laneB) { setSelectedCard(null); return; }

    const swap = (cards: string[], from: string, to: string) =>
      cards.map(c => c === from ? to : c === to ? from : c);

    if (laneA === laneB) {
      // 同道内交换
      const setter = laneA === 'head' ? setMyHeadCards : laneA === 'mid' ? setMyMidCards : setMyTailCards;
      setter(prev => swap(prev, selectedCard, card));
    } else {
      // 跨道交换：从各自道中移除，加到对方道中（保持原位置）
      const setterA = laneA === 'head' ? setMyHeadCards : laneA === 'mid' ? setMyMidCards : setMyTailCards;
      const setterB = laneB === 'head' ? setMyHeadCards : laneB === 'mid' ? setMyMidCards : setMyTailCards;
      setterA(prev => prev.map(c => c === selectedCard ? card : c));
      setterB(prev => prev.map(c => c === card ? selectedCard : c));
    }
    setSelectedCard(null);
  }, [isConfirmed, selectedCard, myHeadCards, myMidCards, myTailCards]);

  const handleRearrange = useCallback(() => {
    setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
    setIsConfirmed(false);
    setSelectedCard(null);
    showToast('已清空，重新摆牌', 'info');
  }, [showToast]);

  const handleAutoArrange = useCallback(async () => {
    if (!game || isAutoArranging) return;
    const allCards = [...myHeadCards, ...myMidCards, ...myTailCards];
    if (allCards.length !== 13) {
      showToast('请先选满13张牌再自动摆牌', 'info');
      return;
    }
    setIsAutoArranging(true);
    setSelectedCard(null);
    try {
      const res = await fetch(`/api/thirteen/${game.id}/auto-arrange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: allCards }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '自动摆牌失败', 'error'); return; }
      setMyHeadCards(data.head);
      setMyMidCards(data.mid);
      setMyTailCards(data.tail);
      showToast(`已自动摆牌: ${data.headName} / ${data.midName} / ${data.tailName}`, 'success');
    } catch { showToast('网络错误', 'error'); }
    finally { setIsAutoArranging(false); }
  }, [game, isAutoArranging, myHeadCards, myMidCards, myTailCards, showToast]);

  // ─── 自动保存草稿（debounce 1秒） ──────────────────────────
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!game || !user || !currentRoundId || isConfirmed) return;
    const totalCards = myHeadCards.length + myMidCards.length + myTailCards.length;
    if (totalCards === 0) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      fetch(`/api/thirteen/${game.id}/save-draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, roundId: currentRoundId,
          headCards: myHeadCards, midCards: myMidCards, tailCards: myTailCards,
        }),
      }).catch(() => {});
    }, 1000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [myHeadCards, myMidCards, myTailCards, game, user, currentRoundId, isConfirmed]);

  const me = useMemo(() => players.find(p => p.user_id === user?.id), [players, user?.id]);
  const opponents = useMemo(() => players.filter(p => p.user_id !== user?.id), [players, user?.id]);

  // ─── 密码键盘 ──────────────────────────────────────────────
  const handlePinKey = (key: string) => {
    if (key === 'backspace') {
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
      // 先验证密码（room_code）是否正确
      // gamesApi.join 会检查 room_code 匹配性，房间满时会返回错误
      await gamesApi.join(code, user.id);
      setNeedsPassword(false);
      const updated = await gamesApi.get(id);
      setGame(updated.game);
      setPlayers(updated.players);
      showToast('已入座', 'success');
      await syncGameState();
    } catch (err: any) {
      // 判断是否是房间满的错误 — 密码正确但无法入座 → 旁观模式
      const errMsg = err?.message || err?.toString() || '';
      if (errMsg.includes('满') || errMsg.includes('full') || errMsg.includes('上限')) {
        setNeedsPassword(false);
        setIsSpectator(true);
        showToast('房间已满，进入旁观模式', 'info');
        await syncGameState();
      } else {
        setPasswordError('密码错误或房间不存在');
        setPasswordPin(['', '', '', '', '', '']);
      }
    } finally { setJoiningGame(false); }
  };

  // ─── Loading / Error ───────────────────────────────────────
  if (isLoading || isSyncing) {
    return (<div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-3">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      <span className="text-sm text-slate-400">{isLoading ? '加载房间...' : '同步游戏状态...'}</span>
    </div>);
  }

  if (!game) {
    return (<div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-4 text-slate-500">
      <span className="material-symbols-outlined text-5xl">error</span>
      <p>房间不存在</p>
      <button onClick={() => navigate('/lobby')} className="text-primary font-bold">返回大厅</button>
    </div>);
  }

  // ─── 密码门禁 ──────────────────────────────────────────────
  if (needsPassword) {
    const pinFull = passwordPin.join('').length === 6;
    return (
      <div className="relative flex h-screen min-h-screen w-full flex-col bg-background-dark text-white">
        <div className="absolute top-6 left-4 z-50">
          <button onClick={() => navigate('/lobby', { replace: true })} className="flex items-center justify-center size-10 rounded-full bg-slate-800/50 hover:bg-slate-700 transition-colors">
            <span className="material-symbols-outlined text-[24px] text-white">close</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-[32px]">lock</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">输入房间密码</h2>
          <p className="text-slate-400 text-sm mb-8">需要6位密码才能进入此房间</p>
          <div className="flex gap-3 mb-8">
            {passwordPin.map((d, i) => (
              <div key={i} className={`w-11 h-14 flex items-center justify-center rounded-xl border-2 text-2xl font-black transition-all ${d ? 'border-primary bg-primary/10 text-white' : 'border-slate-700 bg-slate-800/50 text-slate-600'}`}>
                {d ? '\u2022' : ''}
              </div>
            ))}
          </div>
          {passwordError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-6">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{passwordError}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'].map((key, i) => (
              key === '' ? <div key={i} /> :
                key === 'backspace' ? (
                  <button key={i} onClick={() => handlePinKey('backspace')} className="flex items-center justify-center h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors">
                    <span className="material-symbols-outlined text-slate-400 text-[22px]">backspace</span>
                  </button>
                ) : (
                  <button key={i} onClick={() => handlePinKey(key)} className="flex items-center justify-center h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors text-2xl font-bold">
                    {key}
                  </button>
                )
            ))}
          </div>
          <button onClick={handlePasswordSubmit} disabled={!pinFull || joiningGame}
            className="mt-6 w-full max-w-[280px] py-4 rounded-2xl bg-primary hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all">
            {joiningGame ? '验证中...' : '进入房间'}
          </button>
        </div>
      </div>
    );
  }

  // ─── 等待页面 ──────────────────────────────────────────────

  if (gamePhase === 'waiting') {
    return (
      <div className="min-h-screen bg-background-dark text-white flex flex-col">
        <RoomHeader game={game} finishedRounds={finishedRounds} gamePhase={gamePhase} onBack={() => navigate('/lobby')} onShowScoreBoard={() => setShowScoreBoard(true)} />
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-400">玩家 ({currentPlayers}/{maxPlayers})</h3>
            {currentPlayers < maxPlayers && <span className="text-xs text-amber-400 font-medium animate-pulse">等待加入...</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {players.map(player => {
              const isMe = player.user_id === user?.id;
              const isPlayerHost = player.user_id === game.created_by;
              const total = playerTotals[player.user_id] || 0;
              return (
                <div key={player.id} className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all ${isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-dark border-white/5'}`}>
                  <Avatar username={player.users?.username || '?'} isAdmin={isPlayerHost} className="w-10 h-10" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate text-white">{player.users?.username || '?'}{isMe ? <span className="text-primary text-xs ml-1">(我)</span> : null}</div>
                    <div className="text-[10px] text-slate-500">{isPlayerHost ? '房主' : '玩家'}</div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-black ${total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-400' : 'text-amber-400'}`}>{total > 0 ? `+${total}` : total}</span>
                    <p className="text-[9px] text-slate-500">总分</p>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: maxPlayers - currentPlayers }).map((_, i) => (
              isHost && !isSpectator ? (
                <button key={`empty-${i}`} onClick={() => setShowInvite(true)}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 border-dashed border-white/10 min-h-[72px] hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.97] group cursor-pointer">
                  <span className="material-symbols-outlined text-[24px] text-slate-600 group-hover:text-primary transition-colors">person_add</span>
                  <span className="text-slate-600 group-hover:text-primary text-xs font-medium transition-colors">点击邀请</span>
                </button>
              ) : (
                <div key={`empty-${i}`}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 border-dashed border-white/10 min-h-[72px]">
                  <span className="material-symbols-outlined text-[24px] text-slate-600">person</span>
                  <span className="text-slate-600 text-xs font-medium">等待加入</span>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4">
          {/* 密码加亮显示 */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">房间密码</span>
            <div className="flex gap-2">
              {game.room_code.split('').map((d, i) => (
                <span key={i} className="w-11 h-14 flex items-center justify-center bg-surface-dark rounded-xl text-2xl font-black text-white border border-white/10 shadow-lg shadow-black/20">{d}</span>
              ))}
            </div>
          </div>
          {isSpectator && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="material-symbols-outlined text-slate-400 text-lg">visibility</span>
              <span className="text-slate-400 text-sm font-bold">旁观模式</span>
            </div>
          )}
          <p className="text-slate-500 text-sm text-center">
            {isSpectator
              ? '房间已满，你正在旁观。比牌时可以查看所有玩家的牌。'
              : currentRoundId
              ? '游戏进行中，点击下方按钮回到牌桌'
              : currentPlayers < 2 ? '至少需要 2 名玩家才能开始' : isHost ? '点击下方按钮开始新一局' : '等待房主开始游戏...'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-500">
            <span className="bg-white/5 px-2 py-1 rounded">{game.thirteen_base_score || 1}分/水</span>
            <span className="bg-white/5 px-2 py-1 rounded">{game.thirteen_ghost_count || 6}鬼牌</span>
            {game.thirteen_compare_suit && <span className="bg-white/5 px-2 py-1 rounded">花色比较</span>}
          </div>
        </div>

        {/* 回到游戏 — 有活跃 round 时所有玩家都能看到 */}
        {currentRoundId && !isSpectator && (
          <div className="p-4 border-t border-white/5 pb-8">
            <button onClick={() => setGamePhase('arranging')}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-lg py-4 px-6 rounded-2xl shadow-lg shadow-emerald-700/30 transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined">arrow_forward</span>
              回到游戏
            </button>
          </div>
        )}

        {/* 开始新一局 — 仅房主、无活跃 round 时显示 */}
        {!currentRoundId && isHost && !isSpectator && currentPlayers >= 2 && (
          <div className="p-4 border-t border-white/5 pb-8">
            <button disabled={isStarting} onClick={handleStartRound}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold text-lg py-4 px-6 rounded-2xl shadow-lg shadow-purple-700/30 transition-all active:scale-[0.98] disabled:opacity-60">
              {isStarting ? <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span> : <span className="material-symbols-outlined">play_arrow</span>}
              {isStarting ? '正在开始...' : finishedRounds > 0 ? '开始下一局' : '开始新一局'}
            </button>
          </div>
        )}

        {/* 邀请弹窗 */}
        {showInvite && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowInvite(false)}>
            <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white text-center mb-4">邀请玩家</h3>
              <p className="text-[11px] text-slate-500 text-center uppercase tracking-widest font-bold mb-3">房间密码</p>
              <div className="flex justify-center gap-2 mb-4">
                {game.room_code.split('').map((d, i) => (
                  <span key={i} className="w-10 h-12 flex items-center justify-center bg-background-dark rounded-xl text-xl font-black text-white border border-white/10">{d}</span>
                ))}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(game.room_code); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium mb-4 transition-colors">
                <span className="material-symbols-outlined text-[16px]">{inviteCopied ? 'check' : 'content_copy'}</span>
                {inviteCopied ? '已复制！' : '复制密码'}
              </button>
              <div className="flex justify-center mb-3">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={`${window.location.origin}/join/${game.room_code}`} size={140} level="M" bgColor="#ffffff" fgColor="#101922" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center">扫码直接加入房间</p>
            </div>
          </div>
        )}

        {showScoreBoard && (
          <ScoreBoard gameId={id} gameName={game.name} players={players} playerTotals={playerTotals} finishedRounds={finishedRounds}
            isHost={isHost} userId={user?.id} onClose={() => setShowScoreBoard(false)} onCloseRoom={handleCloseRoom} />
        )}

        {showCloseConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowCloseConfirm(false)}>
            <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-xs border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-red-400">warning</span>
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">关闭房间</h3>
              <p className="text-sm text-slate-400 text-center mb-6">确定要关闭房间吗？关闭后所有玩家将退出。</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCloseConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold transition-colors">取消</button>
                <button onClick={handleCloseRoomConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors active:scale-[0.97]">确定关闭</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>{toast.msg}</div>
        )}
      </div>
    );
  }

  // ─── 游戏进行中 — 根据人数渲染不同桌面组件 ──────────────────

  const publicCardsSet = publicCards.length > 0;

  const tableProps: TableProps = useMemo(() => ({
    game,
    me,
    opponents,
    isHost,
    publicCards,
    publicCardsSet,
    ghostCount,
    confirmedUsers,
    currentPlayers,
    playerTotals,
    myHeadCards,
    myMidCards,
    myTailCards,
    isConfirmed,
    activeLane,
    allSelectedCards,
    isSubmitting,
    isSettling,
    showPicker,
    showInvite,
    inviteCopied,
    showScoreBoard,
    showGhostPicker,
    showCompare,
    roundResult,
    finishedRounds,
    players,
    userId: user?.id,
    setGamePhase,
    setShowGhostPicker,
    setShowInvite,
    setInviteCopied,
    setShowScoreBoard,
    setShowPicker,
    setActiveLane,
    setShowCompare,
    handleSelectCard,
    handleRemoveCard,
    handleCardTap,
    selectedCard,
    handleRearrange,
    handleAutoArrange,
    isAutoArranging,
    handleSubmitHand,
    handleSetPublicCards,
    handleCompareClose,
    handleCloseRoom,
    handleCloseRoomConfirm,
    showCloseConfirm,
    setShowCloseConfirm,
    handleForceSettle,
    showToast,
    toast,
    isSpectator,
  }), [
    game, me, opponents, isHost, publicCards, publicCardsSet, ghostCount,
    confirmedUsers, currentPlayers, playerTotals,
    myHeadCards, myMidCards, myTailCards, isConfirmed, activeLane, allSelectedCards,
    isSubmitting, isSettling, showPicker, showInvite, inviteCopied,
    showScoreBoard, showGhostPicker, showCompare, roundResult, finishedRounds,
    players, user?.id, selectedCard, isAutoArranging, showCloseConfirm, toast, isSpectator,
    handleSelectCard, handleRemoveCard, handleCardTap,
    handleRearrange, handleAutoArrange, handleSubmitHand, handleSetPublicCards,
    handleCompareClose, handleCloseRoom, handleCloseRoomConfirm, handleForceSettle, showToast,
  ]);

  if (currentPlayers <= 2) {
    return <TwoPlayerTable {...tableProps} />;
  } else if (currentPlayers === 3) {
    return <ThreePlayerTable {...tableProps} />;
  } else {
    return <FourPlayerTable {...tableProps} />;
  }
}
