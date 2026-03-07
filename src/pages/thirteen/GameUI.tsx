import React, { memo, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Player } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { evaluateLaneName } from '../../lib/handEval';
import { SUIT_COLOR, RANK_DISPLAY, SUIT_SYMBOL, RoundResult, cardToUrl } from './types';
import { PokerCard } from './PokerCard';
import { CardPickerModal, PublicCardPickerModal } from './CardPicker';
import { ScoreBoard } from './ScoreBoard';
import { CompareAnimation } from './CompareAnimation';

// ─── 常量：占位数组 ─────────────────────────────────────────────
const SLOTS_3 = [null, null, null] as const;
const SLOTS_5 = [null, null, null, null, null] as const;

// ─── 公共牌缩略显示（用于标题栏） ──────────────────────────────

export const PublicCardsThumbnail = memo<{
  publicCards: string[]; ghostCount: number; isHost: boolean;
  onEdit: () => void;
}>(function PublicCardsThumbnail({ publicCards, ghostCount, isHost, onEdit }) {
  if (publicCards.length === 0) {
    return isHost ? (
      <button onClick={onEdit}
        className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg font-bold animate-pulse">
        设置公共牌
      </button>
    ) : (
      <span className="text-xs text-slate-500">等待公共牌...</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 cursor-pointer" onClick={isHost ? onEdit : undefined}>
      <div className="flex gap-1 items-center">
        {publicCards.map((card, i) => {
          const isJoker = card.startsWith('JK');
          if (isJoker) {
            const url = cardToUrl(card);
            return (
              <div key={i} className="w-[29px] h-[40px] rounded-[3px] overflow-hidden bg-white shadow-sm ring-1 ring-purple-400/40">
                {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
              </div>
            );
          }
          const rank = card.slice(0, -1);
          const suit = card.slice(-1);
          return (
            <div key={i} className="w-[29px] h-[40px] rounded-[3px] bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <span className={`text-[10px] font-black ${SUIT_COLOR[suit]} leading-none`}>{RANK_DISPLAY[rank] || rank}</span>
              <span className={`text-[8px] ${SUIT_COLOR[suit]} leading-none`}>{SUIT_SYMBOL[suit]}</span>
            </div>
          );
        })}
      </div>
      {ghostCount > 0 && (
        <span className="text-[11px] text-purple-400 font-black ml-1">{Math.pow(2, ghostCount)}x</span>
      )}
      {isHost && (
         <span className="material-symbols-outlined text-[14px] text-slate-500 ml-0.5">edit</span>
      )}
    </div>
  );
});

// ─── 公共牌中间区域显示（用于2/3人桌） ──────────────────────────

export const PublicCardsCenter = memo<{
  publicCards: string[]; publicCardsSet: boolean; ghostCount: number;
  isHost: boolean; confirmedCount: number; totalPlayers: number;
  onEdit: () => void; size?: 'normal' | 'large';
}>(function PublicCardsCenter({ publicCards, publicCardsSet, ghostCount, isHost, confirmedCount, totalPlayers, onEdit, size = 'normal' }) {
  const cardW = size === 'large' ? 'w-[50px] h-[70px]' : 'w-[38px] h-[52px]';

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-pointer"
      onClick={isHost ? onEdit : undefined}>
      {publicCardsSet ? (
        <>
          <div className="flex gap-1.5 items-center">
            {publicCards.map((card, i) => {
              const isJoker = card.startsWith('JK');
              if (isJoker) {
                const url = cardToUrl(card);
                return (
                  <div key={i} className={`${cardW} rounded-md overflow-hidden bg-white shadow-md ring-2 ring-purple-400/50`}>
                    {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
                  </div>
                );
              }
              const rank = card.slice(0, -1);
              const suit = card.slice(-1);
              const isLarge = size === 'large';
              return (
                <div key={i} className={`${cardW} rounded-md bg-white border border-slate-200 shadow-md ring-1 ring-white/10 flex flex-col items-center justify-center`}>
                  <span className={`${isLarge ? 'text-base' : 'text-sm'} font-black ${SUIT_COLOR[suit]} leading-none`}>{RANK_DISPLAY[rank] || rank}</span>
                  <span className={`${isLarge ? 'text-[12px]' : 'text-[10px]'} ${SUIT_COLOR[suit]} leading-none`}>{SUIT_SYMBOL[suit]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            {ghostCount > 0 && (
              <span className="text-[11px] text-purple-400 font-bold">鬼x{ghostCount} · {Math.pow(2, ghostCount)}倍</span>
            )}
            {isHost && (
              <span className="material-symbols-outlined text-[12px] text-slate-500">edit</span>
            )}
          </div>
        </>
      ) : (
        isHost ? (
          <button onClick={onEdit}
            className="text-xs text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl font-bold animate-pulse transition-all active:scale-95">
            设置公共牌
          </button>
        ) : (
          <span className="text-[11px] text-amber-400/70">等待房主设置公共牌...</span>
        )
      )}
      <span className="text-[10px] text-slate-500">{confirmedCount}/{totalPlayers} 已确认</span>
    </div>
  );
});

// ─── 自己的摆牌区域 ──────────────────────────────────────────

export const MyHandArea = memo<{
  me: Player | undefined;
  isHost: boolean;
  gameCreatedBy: string;
  playerTotals: Record<string, number>;
  myHeadCards: string[];
  myMidCards: string[];
  myTailCards: string[];
  isConfirmed: boolean;
  publicCardsSet: boolean;
  activeLane: 'head' | 'mid' | 'tail';
  setActiveLane: (lane: 'head' | 'mid' | 'tail') => void;
  setShowPicker: (v: boolean) => void;
  handleRemoveCard: (card: string) => void;
  handleCardTap?: (card: string) => void;
  selectedCard?: string | null;
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
  cardSize?: 'small' | 'default' | 'large';
  avatarSize?: string;
  textSize?: string;
}>(function MyHandArea({ me, gameCreatedBy, playerTotals, myHeadCards, myMidCards, myTailCards, isConfirmed, publicCardsSet, activeLane, setActiveLane, setShowPicker, handleRemoveCard, handleCardTap, selectedCard, showToast, cardSize = 'small', avatarSize = 'w-8 h-8', textSize = 'text-xs' }) {
  const score = me ? (playerTotals[me.user_id] || 0) : 0;

  // 缓存牌型评估结果，避免每次渲染重复计算
  const laneEvals = useMemo(() => ({
    head: evaluateLaneName(myHeadCards, 'head'),
    mid: evaluateLaneName(myMidCards, 'mid'),
    tail: evaluateLaneName(myTailCards, 'tail'),
  }), [myHeadCards, myMidCards, myTailCards]);

  // 统一的已摆牌点击处理：用 cardId + onCardClick 模式避免内联函数击穿 PokerCard memo
  const handlePlacedCardClick = useCallback((cardId: string) => {
    if (isConfirmed) return;
    if (handleCardTap) {
      handleCardTap(cardId);
    } else {
      handleRemoveCard(cardId);
    }
  }, [isConfirmed, handleCardTap, handleRemoveCard]);

  // 每个道次的空槽位点击处理（稳定引用）
  const handleHeadEmpty = useCallback(() => { setActiveLane('head'); setShowPicker(true); }, [setActiveLane, setShowPicker]);
  const handleMidEmpty = useCallback(() => { setActiveLane('mid'); setShowPicker(true); }, [setActiveLane, setShowPicker]);
  const handleTailEmpty = useCallback(() => { setActiveLane('tail'); setShowPicker(true); }, [setActiveLane, setShowPicker]);
  const handleNoPublicCards = useCallback(() => showToast('请等待房主设置公共牌', 'info'), [showToast]);

  const emptyClickByLane = useMemo(() => ({
    head: handleHeadEmpty, mid: handleMidEmpty, tail: handleTailEmpty,
  }), [handleHeadEmpty, handleMidEmpty, handleTailEmpty]);

  return (
    <>
      {me && (
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar username={me.users?.username || '?'} isAdmin={me.user_id === gameCreatedBy} className={avatarSize} />
          <span className={`${textSize} font-bold text-white`}>{me.users?.username || '?'}</span>
          <span className={`${textSize} font-black ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {score > 0 ? `+${score}` : score}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1 items-start">
        {(['head', 'mid', 'tail'] as const).map(lane => {
          const cards = lane === 'head' ? myHeadCards : lane === 'mid' ? myMidCards : myTailCards;
          const slots = lane === 'head' ? SLOTS_3 : SLOTS_5;
          const label = lane === 'head' ? '头道' : lane === 'mid' ? '中道' : '尾道';
          const canPick = !isConfirmed && publicCardsSet;
          const isSmall = cardSize === 'small';
          const isLarge = cardSize === 'large';
          const handName = laneEvals[lane];
          const emptyClick = canPick ? emptyClickByLane[lane] : (!isConfirmed && !publicCardsSet ? handleNoPublicCards : undefined);
          return (
            <div key={lane} className="flex items-center gap-1">
              <div className={`${isSmall ? 'w-7' : 'w-8'} flex flex-col items-end`}>
                <span className={`${isSmall ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-medium leading-tight`}>{label}</span>
                {handName && <span className={`text-[10px] font-bold leading-tight ${handName === '含鬼' ? 'text-purple-400' : 'text-amber-400'}`}>{handName}</span>}
              </div>
              <div className={`flex ${isSmall ? 'gap-0.5' : 'gap-1'}`}>
                {slots.map((_, i) => {
                  const card = cards[i];
                  return card
                    ? <PokerCard key={card} card={card} faceUp small={isSmall} large={isLarge}
                        selected={selectedCard === card}
                        cardId={card} onCardClick={!isConfirmed ? handlePlacedCardClick : undefined} />
                    : <PokerCard key={`${lane}-${i}`} small={isSmall} large={isLarge} onClick={emptyClick} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── 底部操作栏 ──────────────────────────────────────────────

export const BottomActionBar = memo<{
  isConfirmed: boolean; isSubmitting: boolean; isSettling: boolean;
  allSelectedCount: number; confirmedCount: number; totalPlayers: number;
  onRearrange: () => void; onAutoArrange: () => void; isAutoArranging: boolean; onSubmit: () => void;
  onForceSettle?: () => void;
}>(function BottomActionBar({ isConfirmed, isSubmitting, isSettling, allSelectedCount, confirmedCount, totalPlayers, onRearrange, onAutoArrange, isAutoArranging, onSubmit, onForceSettle }) { return (
  <div className="p-3 flex flex-col gap-2 shrink-0 bg-black/20 border-t border-white/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
    {!isConfirmed ? (
      <>
        <div className="flex gap-3">
          <button onClick={onRearrange} className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm py-3 rounded-2xl shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98]">
            重新摆牌
          </button>
          <button disabled={allSelectedCount < 13 || isAutoArranging} onClick={onAutoArrange}
            className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-sm py-3 rounded-2xl shadow-lg shadow-violet-600/30 transition-all active:scale-[0.98] disabled:opacity-40">
            {isAutoArranging ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span> : <span className="material-symbols-outlined text-base">auto_fix_high</span>}
            {isAutoArranging ? '计算中...' : '自动摆牌'}
          </button>
        </div>
        <button disabled={allSelectedCount === 0 || isSubmitting} onClick={onSubmit}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-40">
          {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : null}
          {isSubmitting ? '提交中...' : allSelectedCount < 13 ? `确认摆牌 (${allSelectedCount}/13 · 空道乌龙)` : `确认摆牌 (${allSelectedCount}/13)`}
        </button>
      </>
    ) : (
      <>
        <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-emerald-400 font-bold">
            {isSettling ? '正在结算...' : `已确认，等待其他玩家... (${confirmedCount}/${totalPlayers})`}
          </span>
        </div>
        {/* 全员已确认但结算未触发时，显示强制结算按钮 */}
        {!isSettling && confirmedCount >= totalPlayers && totalPlayers >= 2 && onForceSettle && (
          <button onClick={onForceSettle}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm py-3 rounded-2xl shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]">
            <span className="material-symbols-outlined text-base">bolt</span>
            强制结算
          </button>
        )}
      </>
    )}
  </div>
); });

// ─── 旁观者底部栏 ──────────────────────────────────────────────

export const SpectatorBar = memo<{
  confirmedCount: number; totalPlayers: number;
}>(function SpectatorBar({ confirmedCount, totalPlayers }) { return (
  <div className="p-3 flex gap-3 shrink-0 bg-black/20 border-t border-white/5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
    <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10">
      <span className="material-symbols-outlined text-slate-400 text-xl">visibility</span>
      <span className="text-slate-400 font-bold">旁观中 · {confirmedCount}/{totalPlayers} 已确认</span>
    </div>
  </div>
); });

// ─── 弹层集合 ──────────────────────────────────────────────────

export const GameModals = memo<{
  game: { id: string; name: string; room_code: string; thirteen_ghost_count?: number };
  showPicker: boolean; showScoreBoard: boolean; showInvite: boolean;
  inviteCopied: boolean; showGhostPicker: boolean; showCompare: boolean;
  publicCards: string[]; ghostCount: number; roundResult: RoundResult | null;
  activeLane: 'head' | 'mid' | 'tail';
  allSelectedCards: string[]; myHeadCards: string[]; myMidCards: string[];
  myTailCards: string[]; players: Player[]; playerTotals: Record<string, number>;
  finishedRounds: number; isHost: boolean; userId?: string;
  setShowPicker: (v: boolean) => void; setShowInvite: (v: boolean) => void;
  setInviteCopied: (v: boolean) => void; setShowScoreBoard: (v: boolean) => void;
  setShowGhostPicker: (v: boolean) => void; setActiveLane: (lane: 'head' | 'mid' | 'tail') => void;
  handleClosePicker: () => void; handleCloseScoreBoard: () => void; handleCloseGhostPicker: () => void;
  handleSelectCard: (card: string) => void; handleRemoveCard: (card: string) => void;
  handleSetPublicCards: (cards: string[]) => void;
  handleCompareClose: () => void; handleCloseRoom: () => void;
  handleCloseRoomConfirm: () => void; showCloseConfirm: boolean; setShowCloseConfirm: (v: boolean) => void;
  toast: { msg: string; type: 'info' | 'error' | 'success' } | null;
}>(function GameModals(p) { return (
  <>
    {p.showPicker && (
      <CardPickerModal ghostCount={p.game.thirteen_ghost_count || 6} selectedCards={p.allSelectedCards}
        activeLane={p.activeLane} headCards={p.myHeadCards} midCards={p.myMidCards} tailCards={p.myTailCards}
        publicCards={p.publicCards}
        onSelectCard={p.handleSelectCard} onRemoveCard={p.handleRemoveCard} onSwitchLane={p.setActiveLane} onClose={p.handleClosePicker} />
    )}
    {p.showScoreBoard && (
      <ScoreBoard gameId={p.game.id} gameName={p.game.name} players={p.players} playerTotals={p.playerTotals} finishedRounds={p.finishedRounds}
        isHost={p.isHost} userId={p.userId} onClose={p.handleCloseScoreBoard} onCloseRoom={p.handleCloseRoom} />
    )}
    {p.showInvite && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => p.setShowInvite(false)}>
        <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-white text-center mb-4">邀请玩家</h3>
          <p className="text-[11px] text-slate-500 text-center uppercase tracking-widest font-bold mb-3">房间密码</p>
          <div className="flex justify-center gap-2 mb-4">
            {p.game.room_code.split('').map((d, i) => (
              <span key={i} className="w-10 h-12 flex items-center justify-center bg-background-dark rounded-xl text-xl font-black text-white border border-white/10">{d}</span>
            ))}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(p.game.room_code); p.setInviteCopied(true); setTimeout(() => p.setInviteCopied(false), 2000); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium mb-4 transition-colors">
            <span className="material-symbols-outlined text-[16px]">{p.inviteCopied ? 'check' : 'content_copy'}</span>
            {p.inviteCopied ? '已复制！' : '复制密码'}
          </button>
          <div className="flex justify-center mb-3">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={`${window.location.origin}/join/${p.game.room_code}`} size={140} level="M" bgColor="#ffffff" fgColor="#101922" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 text-center">扫码直接加入房间</p>
        </div>
      </div>
    )}
    {p.showGhostPicker && <PublicCardPickerModal
      maxCards={6} maxGhosts={p.game.thirteen_ghost_count || 6} initialCards={p.publicCards}
      onConfirm={p.handleSetPublicCards} onClose={p.handleCloseGhostPicker} />}
    {p.showCompare && p.roundResult && (
      <CompareAnimation result={p.roundResult} players={p.players} userId={p.userId} onClose={p.handleCompareClose} />
    )}
    {p.showCloseConfirm && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => p.setShowCloseConfirm(false)}>
        <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-xs border border-white/10" onClick={e => e.stopPropagation()}>
          <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-red-400">warning</span>
          </div>
          <h3 className="text-lg font-bold text-white text-center mb-2">关闭房间</h3>
          <p className="text-sm text-slate-400 text-center mb-6">确定要关闭房间吗？关闭后所有玩家将退出。</p>
          <div className="flex gap-3">
            <button onClick={() => p.setShowCloseConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold transition-colors">取消</button>
            <button onClick={p.handleCloseRoomConfirm}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors active:scale-[0.97]">确定关闭</button>
          </div>
        </div>
      </div>
    )}
    {p.toast && (
      <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${p.toast.type === 'error' ? 'bg-red-500 text-white' : p.toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>{p.toast.msg}</div>
    )}
  </>
); });
