import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import anime from 'animejs';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi, buyInApi, pendingBuyInApi, BuyIn, Game, Player } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useGameSSE, PendingBuyinEvent } from '../hooks/useGameSSE';
import Avatar from '../components/Avatar';

export default function GameRoom() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const listRef = useRef<HTMLDivElement>(null);

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

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGame = async () => {
    if (!id || !user) return;
    try {
      const { game, buyIns, players } = await gamesApi.get(id);
      setGame(game);
      setBuyIns(buyIns);
      setPlayers(players);
      const isMember = (players as Player[]).some(p => p.user_id === user.id);
      if (!isMember) setNeedsPassword(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchGame(); }, [id, user]);

  useEffect(() => {
    if (!isLoading && listRef.current) {
      anime({
        targets: listRef.current.children,
        translateY: [20, 0], opacity: [0, 1],
        duration: 600, easing: 'easeOutExpo', delay: anime.stagger(150),
      });
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && listRef.current) {
      const children = Array.from(listRef.current.children) as HTMLElement[];
      const newItems = children.filter(el => {
        const currentOpacity = el.style.opacity;
        // 如果还没有被 animejs 设置内联透明度为 1，说明是新加入的元素
        return !currentOpacity || currentOpacity === '0';
      });
      if (newItems.length > 0) {
        anime({ targets: newItems, translateY: [20, 0], opacity: [0, 1], duration: 500, easing: 'easeOutExpo' });
      }
    }
  }, [buyIns.length, pendingRequests.length]);

  // ── SSE 长连接 ─────────────────────────────────────────────────────────────
  useGameSSE(id, user?.id, {
    onConnected: (isHost) => {
      console.log('[SSE] connected, isHost=', isHost);
    },
    // 房主收到新的待审核申请
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
    onGameRefresh: (data) => {
      fetchGame();
    },
    // 申请用户：审核通过通知
    onBuyinApproved: (data) => {
      showToast(`✅ 买入申请已通过！${data.amount} 积分`, 'success');
      fetchGame();
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
        navigate(`/settlement/${id}`);
      }, 1500); // 留出 1.5 秒时间让用户看到完整提示再跳转
    }
  });

  const isHost = user?.id === game?.created_by;
  const needsApproval = game?.insurance_mode === true;

  // 密码键盘
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

  // ── 买入提交 ────────────────────────────────────────────────────────────────
  const handleBuyInSubmit = async () => {
    if (!user || !game || !id || !buyInAmount) return;
    const amount = parseInt(buyInAmount, 10);

    // 校验最小和最高买入限制
    if (amount < game.min_buyin) {
      showToast(`单次买入不能低于最小买入限制 $${game.min_buyin}`, 'error');
      return;
    }
    if (amount > game.max_buyin) {
      showToast(`单次买入不能超过最高买入限制 $${game.max_buyin}`, 'error');
      return;
    }

    const userBuyIns = buyIns.filter(b => b.user_id === user.id && (b.type === 'initial' || b.type === 'rebuy'));
    const type = userBuyIns.length === 0 ? 'initial' : 'rebuy';

    // 带入审核模式 且 非房主 → 提交待审核申请（SSE 通知房主）
    // 带入审核模式 且 非房主 → 提交待审核申请（SSE 通知房主）
    if (needsApproval && !isHost) {
      setSubmitting(true);
      try {
        await pendingBuyInApi.submit(id, user.id, user.username, amount, type);
        showToast('申请已提交，等待房主审核...', 'info');
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
      await buyInApi.record(id, user.id, amount, type);
      await fetchGame();
      setBuyInAmount(''); setShowBuyIn(false);
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
    .filter(b => b.user_id === user?.id && (b.type === 'initial' || b.type === 'rebuy'))
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
        <div className="relative flex h-full min-h-full w-full flex-col bg-[#0f1923] text-white">
          <div className="absolute top-6 left-4 z-50">
            <button onClick={() => navigate('/lobby')} className="flex items-center justify-center size-10 rounded-full bg-slate-800/50 hover:bg-slate-700 transition-colors">
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
                  {d ? '•' : ''}
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
      </AnimatedPage>
    );
  }

  // ── 主游戏界面 ──────────────────────────────────────────────────────────────
  return (
    <AnimatedPage animationType="slide-left">
      <div className="bg-background-light dark:bg-background-dark min-h-full h-full text-slate-900 dark:text-slate-100 font-display antialiased overflow-hidden flex flex-col">

        {/* Toast 通知 */}
        {toast && (
          <div className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-700'
            }`}>
            <span className="material-symbols-outlined text-[16px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            {toast.msg}
          </div>
        )}

        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{game?.name || '牌局'}</h2>
                {game?.users && (
                  <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-700/50 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">grade</span>
                    房主: {game.users.username}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>{game?.room_code} • 盲注 {game?.blind_level}</span>
                {needsApproval && <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">带入审核</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRoomCode(true)} className="flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
            </button>
            <button onClick={() => navigate(`/settlement/${id}`)} className="flex items-center justify-center rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined mr-1" style={{ fontSize: '18px' }}>receipt_long</span>结算
            </button>
          </div>
        </header>

        {/* 房间参与者列表 */}
        <div className="bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            {/* 房主排第一 */}
            {players
              .sort((a, b) => (a.user_id === game?.created_by ? -1 : b.user_id === game?.created_by ? 1 : 0))
              .map(player => {
                const isPlayerHost = player.user_id === game?.created_by;
                return (
                  <div key={player.id} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <Avatar
                        username={player.users?.username || '?'}
                        isAdmin={isPlayerHost}
                        className="w-10 h-10"
                      />
                      {isPlayerHost && (
                        <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-background-dark animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[10px] font-bold truncate max-w-[50px] ${isPlayerHost ? 'text-amber-500' : 'text-slate-500'}`}>
                      {player.users?.username}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 房间码弹窗 */}
        {showRoomCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowRoomCode(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-xs rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-6 flex flex-col items-center text-center">
                <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-3">房间密码</p>
                <div className="flex justify-center gap-2 mb-5">
                  {(game?.room_code || '------').split('').map((d, i) => (
                    <span key={i} className="w-10 h-12 flex items-center justify-center bg-slate-800 rounded-lg text-2xl font-black text-white border border-slate-700">{d}</span>
                  ))}
                </div>
                <button onClick={handleCopyCode} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-sm font-medium mb-3">
                  <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? '已复制！' : '复制密码'}
                </button>
                <button onClick={() => setShowRoomCode(false)} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">关闭</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
          <div ref={listRef} className="flex flex-col gap-4">
            <div className="flex items-center justify-center py-2 opacity-0">
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {game?.created_at ? `开始于 ${formatTime(game.created_at)}` : '游戏进行中'}
              </span>
            </div>

            {/* 时间线：待审核申请（房主可见）+ 已确认买入记录 合并显示，并按时间升序排列 */}
            {[
              ...pendingRequests.map(r => ({ ...r, _pending: true as const, _time: new Date(r.createdAt).getTime() })),
              ...buyIns.filter(b => b.type !== 'checkout').map(b => ({ ...b, _pending: false as const, _time: new Date(b.created_at).getTime() })),
            ].sort((a, b) => a._time - b._time).map((item) => {
              if (item._pending) {
                // 待审核申请条目（只有房主能看到）
                if (!isHost) return null;
                const req = item as PendingBuyinEvent & { _pending: true };
                return (
                  <div key={`p-${req.id}`} className="flex items-end gap-3 opacity-0">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full border-2 border-amber-300 dark:border-amber-600 overflow-hidden">
                        <Avatar username={req.username || '?'} isAdmin={req.userId === game?.created_by} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-background-dark">
                        <span className="material-symbols-outlined text-white text-[10px]">pending</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide">{req.username}</span>
                        {req.userId === game?.created_by && (
                          <span className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-700/50">
                            <span className="material-symbols-outlined text-[10px]">grade</span>
                            房主
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">• {new Date(req.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="ml-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-500 px-1.5 py-0.5 rounded font-bold">待审核</span>
                      </div>
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 rounded-2xl rounded-bl-none bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-3">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-0.5">{req.type === 'initial' ? '初始买入申请' : '重买申请'}</p>
                          <span className="text-xl font-bold text-amber-600 dark:text-amber-400">${req.amount}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => setConfirmReq(req)}
                            className="flex items-center gap-1 bg-primary hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>批准
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 text-slate-500 dark:text-slate-400 text-xs font-bold py-2 px-3 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // 已确认买入条目
                const b = item as BuyIn & { _pending: false };
                return (
                  <div key={b.id} className="flex items-end gap-3 group opacity-0">
                    <div className="relative">
                      <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-background-light dark:border-background-dark ring-2 ring-primary/20">
                        <Avatar username={b.users?.username || '?'} isAdmin={b.user_id === game?.created_by} />
                      </div>
                      {b.user_id === game?.created_by && (
                        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-background-dark animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-start max-w-[80%]">
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide">{b.users?.username || '玩家'}</span>
                        {b.user_id === game?.created_by && (
                          <span className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-700/50">
                            <span className="material-symbols-outlined text-[10px]">grade</span>
                            房主
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">• {formatTime(b.created_at)}</span>
                      </div>
                      <div className="rounded-2xl rounded-bl-none bg-white dark:bg-[#1e2936] p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{b.type === 'initial' ? '初始买入' : '重买/加注'}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-primary">{b.type === 'rebuy' ? '+' : ''}${b.amount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {buyIns.length === 0 && pendingRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center opacity-0">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">casino</span>
                <p className="text-slate-400 text-sm">游戏已开始，点击下方"买入"加入</p>
              </div>
            )}

            {myTotalBuyIn > 0 && (
              <div className="flex justify-center w-full my-2 opacity-0">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg py-3 px-4 w-full flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-500 text-sm">account_balance_wallet</span>
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">你的总买入: <strong>${myTotalBuyIn}</strong></p>
                </div>
              </div>
            )}

            <div className="h-24" />
          </div>
        </main>

        <div className="fixed bottom-6 left-0 right-0 px-4 pointer-events-none flex justify-center z-10 gap-3">
          <button onClick={() => {
            setShowBuyIn(true);
            if (game?.min_buyin) setBuyInAmount(game.min_buyin.toString());
          }} className="pointer-events-auto shadow-lg shadow-primary/20 flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-white transition-transform active:scale-95 hover:bg-primary/90 max-w-[200px]">
            <span className="material-symbols-outlined font-semibold" style={{ fontSize: '24px' }}>add_circle</span>
            <span className="text-base font-bold tracking-wide">买入</span>
          </button>
          <button onClick={() => setShowCheckout(true)} className="pointer-events-auto shadow-lg shadow-emerald-500/20 flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-white transition-transform active:scale-95 hover:bg-emerald-500 max-w-[200px]">
            <span className="material-symbols-outlined font-semibold" style={{ fontSize: '24px' }}>receipt_long</span>
            <span className="text-base font-bold tracking-wide">结账</span>
          </button>
        </div>

        {/* Buy-in Modal */}
        {showBuyIn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setBuyInAmount(''); setShowBuyIn(false); }} />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10">
              <div className="px-6 py-5 text-center border-b border-slate-700/50">
                <h3 className="text-lg font-bold text-white">买入筹码</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {game ? `单次限制: $${game.min_buyin} - $${game.max_buyin}` : '请输入买入筹码数量'}
                </p>
              </div>
              <div className="px-6 py-8">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="text-2xl font-bold text-primary">$</span>
                  </div>
                  <input autoFocus className="block w-full rounded-xl border-2 border-slate-700 bg-slate-900/50 pl-10 pr-4 py-4 text-3xl font-bold text-white placeholder-slate-600 focus:border-primary focus:outline-none text-center tracking-wider"
                    inputMode="decimal" placeholder="0" type="number" value={buyInAmount} onChange={e => setBuyInAmount(e.target.value)} />
                </div>
                {needsApproval && !isHost && (
                  <p className="mt-3 text-center text-xs text-amber-400 flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">info</span>已开启带入审核，提交后等待房主批准
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-700/50">
                <button onClick={() => { setBuyInAmount(''); setShowBuyIn(false); }} className="flex items-center justify-center bg-[#1e2936] py-4 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors">取消</button>
                <button onClick={handleBuyInSubmit} disabled={submitting || !buyInAmount} className="flex items-center justify-center bg-[#1e2936] py-4 text-sm font-bold text-primary hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {submitting ? '处理中...' : needsApproval && !isHost ? '提交申请' : '确认买入'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 带入审核确认对话框 */}
        {confirmReq && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !confirming && setConfirmReq(null)} />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[24px]">how_to_reg</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">确认批准买入？</h3>
                <p className="text-slate-400 text-sm">
                  <strong className="text-white">{confirmReq.username}</strong> 申请
                  {confirmReq.type === 'initial' ? '初始买入' : '重买'}&nbsp;
                  <strong className="text-primary text-base">${confirmReq.amount}</strong>
                </p>
                <p className="text-slate-500 text-xs mt-2">批准后将同步通知房间内所有用户</p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-700/50 mt-2">
                <button
                  onClick={() => setConfirmReq(null)}
                  disabled={confirming}
                  className="bg-[#1e2936] py-4 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmApprove}
                  disabled={confirming}
                  className="bg-[#1e2936] py-4 text-sm font-bold text-primary hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {confirming ? (
                    <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>处理中...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">check_circle</span>确认批准</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Modal */}

        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCheckoutChips(''); setShowCheckout(false); }} />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#1e2936] shadow-2xl ring-1 ring-white/10">
              <div className="px-6 py-5 text-center border-b border-slate-700/50">
                <h3 className="text-lg font-bold text-white">输入剩余筹码</h3>
                <p className="mt-1 text-xs text-slate-400">请输入您当前的筹码总量以完成结算</p>
              </div>
              <div className="px-6 py-8">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <span className="text-2xl font-bold text-primary">$</span>
                  </div>
                  <input autoFocus className="block w-full rounded-xl border-2 border-slate-700 bg-slate-900/50 pl-10 pr-4 py-4 text-3xl font-bold text-white placeholder-slate-600 focus:border-primary focus:outline-none text-center tracking-wider"
                    inputMode="decimal" placeholder="0" type="number" value={checkoutChips} onChange={e => setCheckoutChips(e.target.value)} />
                </div>
                <div className="mt-4 flex justify-between text-xs font-medium text-slate-500 px-1">
                  <span>总买入: ${myTotalBuyIn}</span>
                  <span>预计盈亏: <span className={parseInt(checkoutChips || '0') - myTotalBuyIn >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {checkoutChips ? `${parseInt(checkoutChips) - myTotalBuyIn >= 0 ? '+' : ''}$${parseInt(checkoutChips) - myTotalBuyIn}` : '--'}
                  </span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-700/50">
                <button onClick={() => { setCheckoutChips(''); setShowCheckout(false); }} className="flex items-center justify-center bg-[#1e2936] py-4 text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors">取消</button>
                <button onClick={handleCheckoutSubmit} disabled={submitting || !checkoutChips} className="flex items-center justify-center bg-[#1e2936] py-4 text-sm font-bold text-primary hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {submitting ? '处理中...' : '提交结算'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
