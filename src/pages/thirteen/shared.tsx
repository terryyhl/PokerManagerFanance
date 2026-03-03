import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { Player } from '../../lib/api';
import Avatar from '../../components/Avatar';

// ─── 常量 ────────────────────────────────────────────────────────

export const SUITS = ['S', 'H', 'C', 'D'] as const;
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };
export const SUIT_COLOR: Record<string, string> = { S: 'text-slate-900', H: 'text-red-500', C: 'text-slate-900', D: 'text-red-500' };
export const RANK_DISPLAY: Record<string, string> = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
export const SPECIAL_HAND_NAMES: Record<string, string> = {
  dragon: '青龙', straight_dragon: '一条龙', six_pairs: '六对半',
  three_flush: '三同花', three_straight: '三顺子',
};

const CARD_CDN = 'https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards';
export const CARD_BACK_URL = 'https://deckofcardsapi.com/static/img/back.png';

const RANK_TO_NAME: Record<string, string> = {
  'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king',
};
const SUIT_TO_NAME: Record<string, string> = {
  'S': 'spades', 'H': 'hearts', 'C': 'clubs', 'D': 'diamonds',
};

// ─── 工具函数 ────────────────────────────────────────────────────

/** 将内部牌码 (AS, TH, JK1..JK6) 转为 CDN URL */
export function cardToUrl(card: string): string | null {
  if (card.startsWith('JK')) {
    const num = parseInt(card.slice(2));
    return `${CARD_CDN}/${num <= 3 ? 'black_joker' : 'red_joker'}.svg`;
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const rankName = RANK_TO_NAME[rank];
  const suitName = SUIT_TO_NAME[suit];
  if (!rankName || !suitName) return null;
  return `${CARD_CDN}/${rankName}_of_${suitName}.svg`;
}

// ─── 类型定义 ────────────────────────────────────────────────────

export interface RoundState {
  id: string;
  status: string;
  round_number: number;
  public_cards: string[];
  ghost_count: number;
  ghost_multiplier: number;
}

export interface HandState {
  round_id: string;
  user_id: string;
  head_cards: string[] | null;
  mid_cards: string[] | null;
  tail_cards: string[] | null;
  is_confirmed: boolean;
  is_foul: boolean;
  special_hand: string | null;
  users?: { id: string; username: string };
}

export interface GameState {
  activeRound: RoundState | null;
  hands: HandState[];
  finishedRounds: number;
  playerTotals: Record<string, number>;
  totalPlayers: number;
}

export interface LaneScoreRecord {
  lane: string;
  userId: string;
  opponentId: string;
  score: number;
  detail: string;
}

export interface SettlementPlayer {
  userId: string;
  rawScore: number;
  finalScore: number;
  gunsFired: number;
  homerun: boolean;
  laneScores: LaneScoreRecord[];
}

export interface SettlementResult {
  players: SettlementPlayer[];
}

export interface RoundResult {
  settlement: SettlementResult;
  hands: HandState[];
  ghostCount: number;
  ghostMultiplier: number;
  roundNumber: number;
}

/** 桌面组件共用 Props */
export interface TableProps {
  game: { id: string; name: string; room_code: string; created_by: string; thirteen_ghost_count?: number };
  me: Player | undefined;
  opponents: Player[];
  isHost: boolean;
  publicCards: string[];
  publicCardsSet: boolean;
  ghostCount: number;
  confirmedUsers: Set<string>;
  currentPlayers: number;
  playerTotals: Record<string, number>;
  myHeadCards: string[];
  myMidCards: string[];
  myTailCards: string[];
  isConfirmed: boolean;
  activeLane: 'head' | 'mid' | 'tail';
  allSelectedCards: string[];
  isSubmitting: boolean;
  isSettling: boolean;
  showPicker: boolean;
  showInvite: boolean;
  inviteCopied: boolean;
  showScoreBoard: boolean;
  showGhostPicker: boolean;
  showCompare: boolean;
  roundResult: RoundResult | null;
  finishedRounds: number;
  players: Player[];
  userId?: string;
  setGamePhase: (phase: 'waiting' | 'arranging' | 'revealing' | 'settled') => void;
  setShowGhostPicker: (v: boolean) => void;
  setShowInvite: (v: boolean) => void;
  setInviteCopied: (v: boolean) => void;
  setShowScoreBoard: (v: boolean) => void;
  setShowPicker: (v: boolean) => void;
  setActiveLane: (lane: 'head' | 'mid' | 'tail') => void;
  setShowCompare: (v: boolean) => void;
  handleSelectCard: (card: string) => void;
  handleRemoveCard: (card: string) => void;
  handleRearrange: () => void;
  handleAutoArrange: () => void;
  isAutoArranging: boolean;
  handleSubmitHand: () => void;
  handleSetPublicCards: (cards: string[]) => void;
  handleCompareClose: () => void;
  handleCloseRoom: () => void;
  handleForceSettle: () => void;
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
  toast: { msg: string; type: 'info' | 'error' | 'success' } | null;
  isSpectator: boolean;
}

// ─── 牌面显示组件 ──────────────────────────────────────────────

export const PokerCard: React.FC<{
  card?: string; faceUp?: boolean; small?: boolean; large?: boolean; onClick?: () => void; selected?: boolean;
}> = ({ card, faceUp = true, small = false, large = false, onClick, selected = false }) => {
  const w = large ? 'w-[52px] h-[72px]' : small ? 'w-9 h-[50px]' : 'w-[46px] h-[64px]';

  if (!faceUp || !card) {
    return (
      <div onClick={onClick}
        className={`${w} rounded-lg border-2 border-dashed flex items-center justify-center transition-all
          ${onClick ? 'cursor-pointer hover:border-primary/60 hover:bg-primary/5 active:scale-95' : ''}
          ${selected ? 'border-primary bg-primary/10' : 'border-white/15 bg-white/[0.03]'}`}>
        {onClick && <span className="material-symbols-outlined text-white/20 text-sm">add</span>}
      </div>
    );
  }

  // 鬼牌(大小王)用 CDN 图片
  if (card.startsWith('JK')) {
    const url = cardToUrl(card);
    if (url) {
      return (
        <div onClick={onClick}
          className={`${w} rounded-lg overflow-hidden shadow-sm bg-white ${onClick ? 'cursor-pointer active:scale-95' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}>
          <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} />
        </div>
      );
    }
  }

  // 标准牌用纯文字渲染
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const displayRank = RANK_DISPLAY[rank] || rank;
  const symbol = SUIT_SYMBOL[suit] || '?';
  const color = SUIT_COLOR[suit] || '';
  return (
    <div onClick={onClick} className={`${w} rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center ${onClick ? 'cursor-pointer active:scale-95' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}>
      <span className={`${small ? 'text-[12px]' : 'text-[17px]'} font-black ${color} leading-none`}>{displayRank}</span>
      <span className={`${small ? 'text-[10px]' : 'text-[13px]'} ${color} leading-none`}>{symbol}</span>
    </div>
  );
};

// ─── 牌背组件 ──────────────────────────────────────────────────

export const CardBack: React.FC<{ small?: boolean; large?: boolean }> = ({ small = false, large = false }) => {
  const w = large ? 'w-[52px] h-[72px]' : small ? 'w-8 h-[44px]' : 'w-[46px] h-[64px]';
  return (
    <div className={`${w} rounded-lg overflow-hidden shadow-sm bg-red-900/20`}>
      <img src={CARD_BACK_URL} alt="back" className="w-full h-full object-fill rounded-lg" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} />
    </div>
  );
};

// ─── 对手牌区 ──────────────────────────────────────────────────

export const OpponentArea: React.FC<{
  player: Player; isPlayerHost: boolean; confirmed: boolean; score: number;
}> = ({ player, isPlayerHost, confirmed, score }) => {
  const name = player.users?.username || '?';

  const renderLane = (count: number) => (
    <div className="flex gap-0.5">
      {Array(count).fill(null).map((_, i) => <CardBack key={i} small />)}
    </div>
  );

  const scoreColor = score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-amber-400';
  const scoreText = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <Avatar username={name} isAdmin={isPlayerHost} className="w-7 h-7" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-white truncate max-w-[60px]">{name}</span>
          <span className={`text-[10px] font-black ${scoreColor}`}>{scoreText}</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 relative">
        {renderLane(3)}
        {renderLane(5)}
        {renderLane(5)}
        {confirmed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px]">
            <span className="text-xl font-black text-blue-400 drop-shadow-lg">OK</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 公共牌选牌器 ──────────────────────────────────────────────

export const PublicCardPickerModal: React.FC<{
  maxCards: number; maxGhosts: number; initialCards: string[];
  onConfirm: (cards: string[]) => void; onClose: () => void;
}> = ({ maxCards, maxGhosts, initialCards, onConfirm, onClose }) => {
  const [selected, setSelected] = useState<string[]>(initialCards);
  const selectedSet = new Set(selected);
  const ghostsInSelected = selected.filter(c => c.startsWith('JK')).length;
  const isFull = selected.length >= maxCards;
  const ghostMultiplier = Math.pow(2, ghostsInSelected);

  const toggle = (card: string) => {
    if (selectedSet.has(card)) {
      setSelected(prev => prev.filter(c => c !== card));
    } else {
      if (isFull) return;
      if (card.startsWith('JK') && ghostsInSelected >= maxGhosts) return;
      setSelected(prev => [...prev, card]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="bg-gradient-to-b from-surface-dark to-background-dark border-b border-white/10 pt-3 pb-3 px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">设置公共牌</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selected.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>
              {selected.length}/{maxCards}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
        </div>
        <div className="flex gap-1.5 items-center justify-center flex-wrap">
          {selected.map((card, i) => {
            const isJoker = card.startsWith('JK');
            if (isJoker) {
              const url = cardToUrl(card);
              return (
                <div key={i} onClick={() => toggle(card)} className="w-[38px] h-[52px] rounded-md overflow-hidden bg-white shadow-md cursor-pointer active:scale-90 transition-transform ring-2 ring-purple-400/50">
                  {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
                </div>
              );
            }
            const rank = card.slice(0, -1);
            const suit = card.slice(-1);
            return (
              <div key={i} onClick={() => toggle(card)} className="w-[38px] h-[52px] rounded-md bg-white border border-slate-200 shadow-md cursor-pointer active:scale-90 transition-transform flex flex-col items-center justify-center">
                <span className={`text-sm font-black ${SUIT_COLOR[suit]} leading-none`}>{RANK_DISPLAY[rank] || rank}</span>
                <span className={`text-[10px] ${SUIT_COLOR[suit]} leading-none`}>{SUIT_SYMBOL[suit]}</span>
              </div>
            );
          })}
          {selected.length === 0 && <span className="text-xs text-slate-500 py-4">可只选鬼牌，也可选全部公共牌</span>}
        </div>
        {ghostsInSelected > 0 && (
          <div className="text-center mt-2">
            <span className="text-xs text-purple-400 font-bold">鬼牌 x{ghostsInSelected} · 翻倍 {ghostMultiplier}x</span>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => setSelected([])} className="flex-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10">清空</button>
          <button onClick={() => { onConfirm(selected); onClose(); }} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90">确认</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-8">
        {SUITS.map(suit => (
          <div key={suit} className="mb-2.5">
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <span className={`text-base ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOL[suit]}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {RANKS.map(rank => {
                const card = `${rank}${suit}`;
                const isSelected = selectedSet.has(card);
                const displayRank = RANK_DISPLAY[rank] || rank;
                const suitSymbol = SUIT_SYMBOL[suit] || '?';
                const suitColor = SUIT_COLOR[suit] || '';
                return (
                  <button key={card} onClick={() => toggle(card)}
                    className={`aspect-[2/3] rounded-lg border-2 transition-all bg-white flex flex-col items-center justify-center
                      ${isSelected ? 'border-primary ring-2 ring-primary/60 scale-[0.92]' : isFull ? 'border-transparent opacity-30 cursor-not-allowed' : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer'}`}>
                    <span className={`text-sm font-black ${suitColor} leading-none`}>{displayRank}</span>
                    <span className={`text-[11px] ${suitColor} leading-none`}>{suitSymbol}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {/* 鬼牌 */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-base text-purple-400">★</span>
            <span className="text-[10px] text-purple-400/60">大小王</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }, (_, i) => `JK${i + 1}`).map(card => {
              const isSelected = selectedSet.has(card);
              const num = parseInt(card.slice(2));
              const isBlack = num <= 3;
              const url = cardToUrl(card);
              const ghostFull = !isSelected && ghostsInSelected >= maxGhosts;
              return (
                <button key={card} onClick={() => !ghostFull && toggle(card)} disabled={ghostFull && !isSelected}
                  className={`aspect-[2/3] w-[calc((100%-6*6px)/7)] rounded-lg overflow-hidden border-2 transition-all relative
                    ${isSelected ? 'border-purple-400 ring-2 ring-purple-400/60 scale-[0.92]' : ghostFull ? 'border-transparent opacity-30 cursor-not-allowed' : isFull ? 'border-transparent opacity-30 cursor-not-allowed' : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer'}`}>
                  {url && <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" />}
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-[7px] font-bold ${isBlack ? 'text-slate-800' : 'text-red-500'} bg-white/80 px-0.5`}>
                    {isBlack ? '大王' : '小王'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 选牌弹层 ────────────────────────────────────────────────

export const CardPickerModal: React.FC<{
  ghostCount: number; selectedCards: string[]; activeLane: 'head' | 'mid' | 'tail';
  headCards: string[]; midCards: string[]; tailCards: string[];
  publicCards: string[];
  onSelectCard: (card: string) => void; onRemoveCard: (card: string) => void;
  onSwitchLane: (lane: 'head' | 'mid' | 'tail') => void; onClose: () => void;
}> = ({ ghostCount, selectedCards, activeLane, headCards, midCards, tailCards, publicCards, onSelectCard, onRemoveCard, onSwitchLane, onClose }) => {
  const laneMax = { head: 3, mid: 5, tail: 5 };
  const laneCards = { head: headCards, mid: midCards, tail: tailCards };
  const laneLabels = { head: '头道', mid: '中道', tail: '尾道' };
  const currentLaneCards = laneCards[activeLane];
  const currentLaneFull = currentLaneCards.length >= laneMax[activeLane];
  const currentLaneSet = new Set(currentLaneCards);
  const otherLaneCards = new Set(
    (['head', 'mid', 'tail'] as const).filter(l => l !== activeLane).flatMap(l => laneCards[l])
  );
  const publicSet = new Set(publicCards);

  const autoSwitchLane = () => {
    const order: Array<'head' | 'mid' | 'tail'> = ['tail', 'mid', 'head'];
    for (const l of order) {
      if (l !== activeLane && laneCards[l].length < laneMax[l]) {
        onSwitchLane(l);
        return;
      }
    }
  };

  const handleSelect = (card: string) => {
    onSelectCard(card);
    if (currentLaneCards.length + 1 >= laneMax[activeLane]) {
      setTimeout(autoSwitchLane, 100);
    }
  };

  const totalSelected = selectedCards.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="bg-gradient-to-b from-surface-dark to-background-dark border-b border-white/10 pt-3 pb-3 px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">选牌摆牌</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalSelected >= 13 ? 'bg-emerald-500/20 text-emerald-400' : totalSelected > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>
              {totalSelected}/13{totalSelected > 0 && totalSelected < 13 ? ' · 空道乌龙' : ''}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
        </div>
        <div className="flex gap-1.5 mb-3">
          {(['head', 'mid', 'tail'] as const).map(lane => {
            const isFull = laneCards[lane].length >= laneMax[lane];
            return (
              <button key={lane} onClick={() => onSwitchLane(lane)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative
                  ${activeLane === lane ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : isFull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}>
                <span>{laneLabels[lane]}</span>
                <span className="ml-1 text-[10px] opacity-70">{laneCards[lane].length}/{laneMax[lane]}</span>
                {isFull && activeLane !== lane && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[10px]">check</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 justify-center min-h-[68px] items-center bg-white/[0.02] rounded-xl py-2 px-1">
          {Array(laneMax[activeLane]).fill(null).map((_, i) => {
            const card = currentLaneCards[i];
            return card
              ? <PokerCard key={card} card={card} faceUp onClick={() => onRemoveCard(card)} />
              : <PokerCard key={`empty-${i}`} />;
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-8">
        {SUITS.map(suit => (
          <div key={suit} className="mb-2.5">
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <span className={`text-base ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOL[suit]}</span>
              <span className={`text-[10px] ${SUIT_COLOR[suit] === 'text-red-500' ? 'text-red-400/60' : 'text-slate-500'}`}>
                {suit === 'S' ? '黑桃' : suit === 'H' ? '红桃' : suit === 'C' ? '梅花' : '方片'}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {RANKS.map(rank => {
                const card = `${rank}${suit}`;
                const inCurrentLane = currentLaneSet.has(card);
                const inOtherLane = otherLaneCards.has(card);
                const isPublic = publicSet.has(card);
                const isDisabled = isPublic || inOtherLane || (!inCurrentLane && currentLaneFull);
                const displayRank = RANK_DISPLAY[rank] || rank;
                const suitSymbol = SUIT_SYMBOL[suit] || '?';
                const suitColor = SUIT_COLOR[suit] || '';
                return (
                  <button key={card} disabled={isDisabled && !inCurrentLane}
                    onClick={() => inCurrentLane ? onRemoveCard(card) : !isDisabled ? handleSelect(card) : undefined}
                    className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all relative bg-white flex flex-col items-center justify-center
                      ${inCurrentLane ? 'border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/20 scale-[0.92]'
                        : isPublic ? 'border-amber-500/30 opacity-25 cursor-not-allowed'
                        : inOtherLane ? 'border-transparent opacity-20 cursor-not-allowed grayscale'
                        : isDisabled ? 'border-transparent opacity-30 cursor-not-allowed'
                        : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer shadow-sm hover:shadow-md'}`}>
                    <span className={`text-sm font-black ${suitColor} leading-none`}>{displayRank}</span>
                    <span className={`text-[11px] ${suitColor} leading-none`}>{suitSymbol}</span>
                    {isPublic && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-[8px] text-amber-400 font-bold">公</span>
                      </div>
                    )}
                    {inOtherLane && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="material-symbols-outlined text-white/40 text-sm">check</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {ghostCount > 0 && (() => {
          const allJokers = Array.from({ length: 6 }, (_, i) => `JK${i + 1}`);
          const availableJokers = allJokers.filter(jk => !publicSet.has(jk));
          return availableJokers.length > 0 ? (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <span className="text-base text-purple-400">★</span>
                <span className="text-[10px] text-purple-400/60">大小王</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableJokers.map(card => {
                  const inCurrentLane = currentLaneSet.has(card);
                  const inOtherLane = otherLaneCards.has(card);
                  const isDisabled = inOtherLane || (!inCurrentLane && currentLaneFull);
                  const num = parseInt(card.slice(2));
                  const isBlack = num <= 3;
                  const url = cardToUrl(card);
                  return (
                    <button key={card} disabled={isDisabled && !inCurrentLane}
                      onClick={() => inCurrentLane ? onRemoveCard(card) : !isDisabled ? handleSelect(card) : undefined}
                      className={`aspect-[2/3] w-[calc((100%-6*6px)/7)] rounded-lg overflow-hidden border-2 transition-all relative
                        ${inCurrentLane ? 'border-purple-400 ring-2 ring-purple-400/60 shadow-lg shadow-purple-500/20 scale-[0.92]'
                          : inOtherLane ? 'border-transparent opacity-20 cursor-not-allowed grayscale'
                          : isDisabled ? 'border-transparent opacity-30 cursor-not-allowed'
                          : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer shadow-sm hover:shadow-md'}`}>
                      {url && <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" />}
                      <span className={`absolute bottom-0 left-0 right-0 text-center text-[7px] font-bold ${isBlack ? 'text-slate-800' : 'text-red-500'} bg-white/80 px-0.5`}>
                        {isBlack ? '大王' : '小王'}
                      </span>
                      {inOtherLane && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="material-symbols-outlined text-white/40 text-sm">check</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
};

// ─── 积分账单面板 ────────────────────────────────────────────

export const ScoreBoard: React.FC<{
  gameId: string; gameName: string; players: Player[]; playerTotals: Record<string, number>;
  finishedRounds: number; isHost: boolean; userId?: string;
  onClose: () => void; onCloseRoom: () => void;
}> = ({ gameId, gameName, players, playerTotals, finishedRounds, isHost, userId, onClose, onCloseRoom }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [replayResult, setReplayResult] = useState<RoundResult | null>(null);
  const [loadingRoundId, setLoadingRoundId] = useState<string | null>(null);

  // 分享海报
  const [showSharePoster, setShowSharePoster] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/thirteen/${gameId}/history?_t=${Date.now()}`);
        const data = await res.json();
        setHistory(data.rounds || []);
      } catch { /* ignore */ }
      setLoadingHistory(false);
    })();
  }, [gameId]);

  const handleViewRound = async (roundId: string) => {
    if (loadingRoundId) return;
    setLoadingRoundId(roundId);
    try {
      const res = await fetch(`/api/thirteen/${gameId}/round/${roundId}?_t=${Date.now()}`);
      const data = await res.json();
      if (!data.round) return;
      // 将后端数据转换为 RoundResult
      const settlementPlayers: SettlementPlayer[] = (data.totals || []).map((t: any) => ({
        userId: t.user_id,
        rawScore: t.raw_score,
        finalScore: t.final_score,
        gunsFired: t.guns_fired,
        homerun: t.homerun,
        laneScores: (data.scores || [])
          .filter((s: any) => s.user_id === t.user_id)
          .map((s: any) => ({ lane: s.lane, userId: s.user_id, opponentId: s.opponent_id, score: s.score, detail: s.detail })),
      }));
      const handStates: HandState[] = (data.hands || []).map((h: any) => ({
        user_id: h.user_id,
        head_cards: h.head_cards,
        mid_cards: h.mid_cards,
        tail_cards: h.tail_cards,
        is_confirmed: h.is_confirmed,
        is_foul: h.is_foul,
        special_hand: h.special_hand,
        users: h.users,
      }));
      setReplayResult({
        settlement: { players: settlementPlayers },
        hands: handStates,
        ghostCount: data.round.ghost_count || 0,
        ghostMultiplier: data.round.ghost_multiplier || 1,
        roundNumber: data.round.round_number,
      });
    } catch { /* ignore */ }
    setLoadingRoundId(null);
  };

  const generateImage = useCallback(async () => {
    if (!posterRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 3, backgroundColor: '#0f1923' });
      setPreviewUrl(dataUrl);
    } catch (err) { console.error('生成图片失败:', err); }
    finally { setIsGenerating(false); }
  }, []);

  const handleShare = async () => {
    if (!previewUrl) return;
    const res = await fetch(previewUrl);
    const blob = await res.blob();
    const file = new File([blob], `十三水积分_${gameName}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: `${gameName} 积分账单`, files: [file] }); return; } catch { /* cancelled */ }
    }
    const a = document.createElement('a');
    a.href = previewUrl; a.download = `十三水积分_${gameName}.png`; a.click();
  };

  const handleSaveImage = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl; a.download = `十三水积分_${gameName}.png`; a.click();
  };

  const sorted = players
    .map(p => ({ ...p, total: playerTotals[p.user_id] || 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="bg-background-dark flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 shrink-0">
          <h2 className="text-lg font-bold text-white">积分账单</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => { setPreviewUrl(null); setShowSharePoster(true); }} className="p-1.5 rounded-lg hover:bg-white/10" title="分享">
              <span className="material-symbols-outlined text-white">share</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">已完成 <span className="text-white font-bold">{finishedRounds}</span> 局</span>
            </div>
            <div className="space-y-2">
              {sorted.map((p, idx) => {
                const name = p.users?.username || '?';
                const isMe = p.user_id === userId;
                return (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-dark border-white/5'}`}>
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black ${idx === 0 && p.total > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500'}`}>{idx + 1}</span>
                    <Avatar username={name} className="w-8 h-8" />
                    <div className="flex-1 min-w-0"><span className="text-sm font-bold text-white truncate block">{name}{isMe ? ' (我)' : ''}</span></div>
                    <span className={`text-lg font-black ${p.total > 0 ? 'text-emerald-400' : p.total < 0 ? 'text-red-400' : 'text-amber-400'}`}>{p.total > 0 ? `+${p.total}` : p.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-slate-400 mb-3">每局明细</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-2xl text-slate-600">progress_activity</span></div>
            ) : history.length === 0 ? (
              <p className="text-center text-slate-600 text-sm py-8">暂无已完成的牌局</p>
            ) : (
              <div className="space-y-2">
                {history.filter((r: any) => r.status === 'finished').map((round: any) => (
                  <div key={round.id}
                    className="bg-surface-dark rounded-xl border border-white/5 p-3 active:bg-white/[0.06] transition-colors cursor-pointer"
                    onClick={() => handleViewRound(round.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400">第 {round.round_number} 局</span>
                      <div className="flex items-center gap-2">
                        {round.ghost_count > 0 && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">鬼x{round.ghost_count} ({round.ghost_multiplier}倍)</span>}
                        {loadingRoundId === round.id
                          ? <span className="material-symbols-outlined animate-spin text-sm text-slate-500">progress_activity</span>
                          : <span className="material-symbols-outlined text-sm text-slate-600">chevron_right</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(round.totals || []).sort((a: any, b: any) => b.final_score - a.final_score).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{t.users?.username || '?'}</span>
                          <div className="flex items-center gap-2">
                            {t.guns_fired > 0 && <span className="text-amber-400 text-[10px]">打枪x{t.guns_fired}</span>}
                            {t.homerun && <span className="text-yellow-400 text-[10px]">全垒打</span>}
                            <span className={`font-black ${t.final_score > 0 ? 'text-emerald-400' : t.final_score < 0 ? 'text-red-400' : 'text-amber-400'}`}>{t.final_score > 0 ? `+${t.final_score}` : t.final_score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {isHost && (
          <div className="p-4 border-t border-white/5 shrink-0 pb-8">
            <button onClick={onCloseRoom} className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-base py-3.5 rounded-2xl border border-red-500/20 transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined text-xl">power_settings_new</span>关闭房间
            </button>
          </div>
        )}
      </div>
      {replayResult && (
        <CompareAnimation
          result={replayResult}
          players={players}
          userId={userId}
          onClose={() => setReplayResult(null)}
          replay
          gameName={gameName}
        />
      )}
      {/* 分享海报弹层 */}
      {showSharePoster && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm" onClick={() => setShowSharePoster(false)}>
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4" onClick={e => e.stopPropagation()}>
            {/* 隐藏的海报 DOM — 用于截图 */}
            {!previewUrl && (
              <div ref={posterRef} style={{
                width: 375, padding: '28px 20px',
                background: 'linear-gradient(180deg, #0f1923 0%, #162230 50%, #0f1923 100%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: '#e2e8f0',
              }}>
                {/* 头部 */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', background: 'rgba(168,85,247,0.15)',
                    borderRadius: 20, border: '1px solid rgba(168,85,247,0.3)', marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#c084fc' }}>{gameName}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>积分账单</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>已完成 {finishedRounds} 局 · 十三水</div>
                </div>
                {/* 玩家排名 */}
                <div style={{
                  background: 'rgba(26,38,50,0.8)', borderRadius: 16,
                  border: '1px solid rgba(51,65,85,0.5)', overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', padding: '10px 16px',
                    fontSize: 10, fontWeight: 600, color: '#64748b',
                    borderBottom: '1px solid rgba(51,65,85,0.5)', letterSpacing: 1,
                  }}>
                    <span style={{ width: 28 }}>#</span>
                    <span style={{ flex: 1 }}>玩家</span>
                    <span style={{ width: 80, textAlign: 'right' as const }}>总积分</span>
                  </div>
                  {sorted.map((p, idx) => {
                    const name = p.users?.username || '?';
                    const isMe = p.user_id === userId;
                    const rankColors: Record<number, string> = { 1: '#fbbf24', 2: '#94a3b8', 3: '#d97706' };
                    const rankColor = rankColors[idx + 1] || '#475569';
                    const scoreColor = p.total > 0 ? '#34d399' : p.total < 0 ? '#f87171' : '#fbbf24';
                    const initial = name.charAt(0).toUpperCase();
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px',
                        borderBottom: idx < sorted.length - 1 ? '1px solid rgba(51,65,85,0.3)' : 'none',
                        background: isMe ? 'rgba(59,130,246,0.08)' : 'transparent',
                      }}>
                        <span style={{ width: 28, fontSize: idx < 3 ? 16 : 13, fontWeight: 800, color: rankColor }}>
                          {idx < 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][idx] : idx + 1}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${isMe ? '#3b82f6' : '#475569'}, ${isMe ? '#60a5fa' : '#64748b'})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                          }}>{initial}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600,
                              color: isMe ? '#60a5fa' : '#e2e8f0',
                              whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {name}{isMe ? <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 4 }}>(我)</span> : null}
                            </div>
                          </div>
                        </div>
                        <span style={{ width: 80, textAlign: 'right' as const, fontSize: 16, fontWeight: 800, color: scoreColor }}>
                          {p.total > 0 ? '+' : ''}{p.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* 底部水印 */}
                <div style={{ textAlign: 'center' as const, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(51,65,85,0.3)' }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>Poker Finance Manager</div>
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{new Date().toLocaleDateString('zh-CN')} 生成</div>
                </div>
              </div>
            )}
            {/* 预览已生成的图片 */}
            {previewUrl && (
              <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                <img src={previewUrl} alt="积分账单" className="w-full rounded-xl shadow-2xl border border-slate-700" />
              </div>
            )}
            {/* 操作按钮 */}
            <div className="flex flex-col gap-3 w-full max-w-sm mt-6">
              {!previewUrl ? (
                <button onClick={generateImage} disabled={isGenerating}
                  className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                  {isGenerating ? (<><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>生成中...</>)
                    : (<><span className="material-symbols-outlined text-[20px]">image</span>生成分享图片</>)}
                </button>
              ) : (
                <>
                  <button onClick={handleShare}
                    className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">share</span>分享给好友
                  </button>
                  <button onClick={handleSaveImage}
                    className="w-full py-3.5 rounded-xl bg-slate-700 text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">download</span>保存到相册
                  </button>
                </>
              )}
              <button onClick={() => setShowSharePoster(false)}
                className="w-full py-3 rounded-xl text-slate-400 font-medium text-sm transition-colors hover:text-white">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 逐对逐道比牌动画 ──────────────────────────────────────

export const CompareAnimation: React.FC<{
  result: RoundResult; players: Player[]; userId?: string; onClose: () => void; replay?: boolean; gameName?: string;
}> = ({ result, players, userId, onClose, replay = false, gameName }) => {
  const { settlement, hands, ghostCount, ghostMultiplier, roundNumber } = result;
  const playerMap: Record<string, Player> = {};
  for (const p of players) playerMap[p.user_id] = p;

  // 构建两两对战列表
  const allPlayerIds = settlement.players.map(p => p.userId);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < allPlayerIds.length; i++) {
    for (let j = i + 1; j < allPlayerIds.length; j++) {
      pairs.push([allPlayerIds[i], allPlayerIds[j]]);
    }
  }

  // 构建每对每道的得分查找表: key = "userId_opponentId_lane" → score
  const pairLaneScores: Record<string, number> = {};
  for (const sp of settlement.players) {
    for (const ls of sp.laneScores) {
      if (ls.lane === 'head' || ls.lane === 'mid' || ls.lane === 'tail') {
        const key = `${ls.userId}_${ls.opponentId}_${ls.lane}`;
        pairLaneScores[key] = (pairLaneScores[key] || 0) + ls.score;
      }
    }
  }

  // 检测每对是否打枪
  const pairGunStatus: Record<string, { gunner: string | null }> = {};
  for (const [a, b] of pairs) {
    const key = `${a}_${b}`;
    const lanes: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
    let aWins = 0, bWins = 0;
    for (const lane of lanes) {
      const scoreA = pairLaneScores[`${a}_${b}_${lane}`] || 0;
      if (scoreA > 0) aWins++;
      else if (scoreA < 0) bWins++;
    }
    pairGunStatus[key] = { gunner: aWins === 3 ? a : bWins === 3 ? b : null };
  }

  const laneNames: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
  const laneLabels: Record<string, string> = { head: '头道', mid: '中道', tail: '尾道' };

  // 总阶段数: 每对3道 + 最终汇总
  const totalPairPhases = pairs.length * 3;
  const summaryPhase = totalPairPhases;

  const [phase, setPhase] = useState(replay ? summaryPhase : -1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEffect, setShowEffect] = useState(false);

  // 分享截图
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 检测打枪/全垒打
  const hasHomerun = settlement.players.some(p => p.homerun);
  const hasGun = settlement.players.some(p => p.gunsFired > 0);
  const effectType = hasHomerun ? 'homerun' : hasGun ? 'gun' : null;

  useEffect(() => {
    if (replay) return;
    timerRef.current = setTimeout(() => setPhase(0), 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [replay]);

  useEffect(() => {
    if (replay) return;
    if (phase < 0 || phase >= summaryPhase) return;
    timerRef.current = setTimeout(() => setPhase(phase + 1), 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, replay, summaryPhase]);

  // 进入结算阶段时触发特效
  useEffect(() => {
    if (phase === summaryPhase && effectType && !replay) {
      setShowEffect(true);
      const t = setTimeout(() => setShowEffect(false), 2500);
      return () => clearTimeout(t);
    }
  }, [phase, effectType, replay, summaryPhase]);

  const sorted = [...settlement.players].sort((a, b) => b.finalScore - a.finalScore);

  const skipToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase(summaryPhase);
  };

  const getName = (uid: string) => playerMap[uid]?.users?.username || '?';
  const isMe = (uid: string) => uid === userId;

  const handleCapture = useCallback(async () => {
    if (!contentRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(contentRef.current, { pixelRatio: 3, backgroundColor: '#0a0a0a' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `十三水_第${roundNumber}局${gameName ? '_' + gameName : ''}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ title: `第${roundNumber}局对比`, files: [file] }); setIsCapturing(false); return; } catch { /* cancelled */ }
      }
      const a = document.createElement('a');
      a.href = dataUrl; a.download = fileName; a.click();
    } catch (err) { console.error('截图失败:', err); }
    setIsCapturing(false);
  }, [isCapturing, roundNumber, gameName]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col overflow-hidden" onClick={!replay && phase < summaryPhase ? skipToEnd : undefined}>
      <div className="flex-1 flex flex-col overflow-y-auto" ref={contentRef}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">第 {roundNumber} 局</span>
            {ghostCount > 0 && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg font-bold">
                鬼x{ghostCount} {ghostMultiplier}倍
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(phase >= summaryPhase || replay) && (
              <button onClick={(e) => { e.stopPropagation(); handleCapture(); }} className="p-1.5 rounded-lg hover:bg-white/10" title="分享">
                {isCapturing
                  ? <span className="material-symbols-outlined text-white animate-spin text-[20px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-white text-[20px]">share</span>}
              </button>
            )}
            {(phase >= summaryPhase || replay) && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 px-3 pt-2 pb-4 space-y-3">
          {/* 逐对比牌 */}
          {pairs.map(([pA, pB], pairIdx) => {
            const pairStartPhase = pairIdx * 3;
            const pairVisible = phase >= pairStartPhase || replay;
            if (!pairVisible) return null;

            const handA = hands.find(h => h.user_id === pA);
            const handB = hands.find(h => h.user_id === pB);
            const nameA = getName(pA);
            const nameB = getName(pB);
            const pairKey = `${pA}_${pB}`;
            const gun = pairGunStatus[pairKey];

            // 该对的三道总得分（A视角）
            let pairTotalA = 0;
            for (const lane of laneNames) {
              pairTotalA += pairLaneScores[`${pA}_${pB}_${lane}`] || 0;
            }

            const pairDone = phase >= pairStartPhase + 3 || replay;

            return (
              <div key={pairKey} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                {/* 对战标题 */}
                <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isMe(pA) ? 'text-primary' : 'text-white'}`}>{nameA}</span>
                    <span className="text-[10px] text-slate-500">VS</span>
                    <span className={`text-xs font-bold ${isMe(pB) ? 'text-primary' : 'text-white'}`}>{nameB}</span>
                  </div>
                  {pairDone && (
                    <div className="flex items-center gap-2">
                      {gun?.gunner && <span className="text-[10px] text-orange-400 font-bold">{getName(gun.gunner)} 打枪!</span>}
                      <span className={`text-xs font-black ${pairTotalA > 0 ? 'text-emerald-400' : pairTotalA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {pairTotalA > 0 ? `+${pairTotalA}` : pairTotalA} : {-pairTotalA > 0 ? `+${-pairTotalA}` : -pairTotalA}
                      </span>
                    </div>
                  )}
                </div>
                {/* 三道对比 */}
                <div className="p-2 space-y-1.5">
                  {laneNames.map((lane, laneIdx) => {
                    const lanePhase = pairStartPhase + laneIdx;
                    const revealed = phase >= lanePhase || replay;
                    const isActive = phase === lanePhase;
                    const cardCount = lane === 'head' ? 3 : 5;
                    const cardsA = handA ? (lane === 'head' ? handA.head_cards : lane === 'mid' ? handA.mid_cards : handA.tail_cards) : null;
                    const cardsB = handB ? (lane === 'head' ? handB.head_cards : lane === 'mid' ? handB.mid_cards : handB.tail_cards) : null;
                    const scoreA = pairLaneScores[`${pA}_${pB}_${lane}`] || 0;

                    return (
                      <div key={lane} className={`rounded-xl p-2 transition-all duration-300 ${isActive ? 'bg-primary/5 ring-1 ring-primary/30' : revealed ? 'bg-white/[0.01]' : 'opacity-30'}`}>
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] font-bold ${isActive ? 'text-primary' : 'text-slate-500'}`}>{laneLabels[lane]}</span>
                          {revealed && isActive && <span className="text-[9px] text-primary animate-pulse">比牌中</span>}
                        </div>
                        {/* 两行: A 的牌 和 B 的牌 */}
                        <div className="space-y-1">
                          {/* 玩家 A */}
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold w-10 truncate ${isMe(pA) ? 'text-primary' : 'text-slate-400'}`}>{nameA}</span>
                            <div className="flex gap-0.5 flex-1">
                              {revealed && cardsA
                                ? cardsA.map((c, i) => <PokerCard key={i} card={c} faceUp small />)
                                : Array(cardCount).fill(null).map((_, i) => <CardBack key={i} small />)}
                            </div>
                            <div className="w-10 text-right">
                              {revealed && (
                                <span className={`text-xs font-black ${scoreA > 0 ? 'text-emerald-400' : scoreA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                  {scoreA > 0 ? `+${scoreA}` : scoreA}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 玩家 B */}
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold w-10 truncate ${isMe(pB) ? 'text-primary' : 'text-slate-400'}`}>{nameB}</span>
                            <div className="flex gap-0.5 flex-1">
                              {revealed && cardsB
                                ? cardsB.map((c, i) => <PokerCard key={i} card={c} faceUp small />)
                                : Array(cardCount).fill(null).map((_, i) => <CardBack key={i} small />)}
                            </div>
                            <div className="w-10 text-right">
                              {revealed && (
                                <span className={`text-xs font-black ${-scoreA > 0 ? 'text-emerald-400' : -scoreA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                  {-scoreA > 0 ? `+${-scoreA}` : -scoreA}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 最终汇总 */}
          {(phase >= summaryPhase || replay) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 animate-[fadeIn_0.5s_ease-out]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-400">最终结算</span>
                {ghostMultiplier > 1 && <span className="text-[10px] text-purple-400">鬼牌 {ghostMultiplier}x</span>}
              </div>
              {sorted.map((sp, idx) => {
                const name = getName(sp.userId);
                const hand = hands.find(h => h.user_id === sp.userId);
                return (
                  <div key={sp.userId} className={`flex items-center gap-3 p-3 rounded-xl border ${isMe(sp.userId) ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.03] border-white/5'}`}>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${idx === 0 && sp.finalScore > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500'}`}>{idx + 1}</span>
                    <Avatar username={name} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white truncate block">{name}{isMe(sp.userId) ? ' (我)' : ''}</span>
                      <div className="flex items-center gap-2 text-[10px] mt-0.5">
                        {hand?.is_foul && <span className="text-red-400 font-bold">乌龙</span>}
                        {hand?.special_hand && <span className="text-yellow-400 font-bold">{SPECIAL_HAND_NAMES[hand.special_hand] || hand.special_hand}</span>}
                        {sp.gunsFired > 0 && <span className="text-amber-400">打枪x{sp.gunsFired}</span>}
                        {sp.homerun && <span className="text-yellow-300 font-bold">全垒打!</span>}
                      </div>
                    </div>
                    <span className={`text-2xl font-black ${sp.finalScore > 0 ? 'text-emerald-400' : sp.finalScore < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {sp.finalScore > 0 ? `+${sp.finalScore}` : sp.finalScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {(phase >= summaryPhase || replay) && (
        <div className="p-4 pb-8 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-base shadow-lg shadow-primary/30 transition-all active:scale-[0.98]">
            继续
          </button>
        </div>
      )}
      {/* 打枪/全垒打全屏特效 */}
      {showEffect && effectType && (
        <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center animate-[effectIn_0.3s_ease-out]"
          onClick={() => setShowEffect(false)}>
          <div className={`absolute inset-0 ${effectType === 'homerun'
            ? 'bg-gradient-radial from-yellow-500/30 via-amber-600/10 to-transparent'
            : 'bg-gradient-radial from-orange-500/25 via-red-600/10 to-transparent'} animate-pulse`} />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full animate-[particle_1.5s_ease-out_forwards]"
              style={{
                background: effectType === 'homerun' ? '#fbbf24' : '#f97316',
                left: '50%', top: '50%',
                animationDelay: `${i * 80}ms`,
                transform: `rotate(${i * 30}deg) translateY(-40px)`,
                opacity: 0,
              }} />
          ))}
          <div className="relative flex flex-col items-center gap-3 animate-[effectBounce_0.6s_cubic-bezier(0.34,1.56,0.64,1)]">
            <span className="text-6xl">
              {effectType === 'homerun' ? '💥' : '🔫'}
            </span>
            <div className={`text-4xl font-black tracking-wider ${effectType === 'homerun'
              ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]'
              : 'text-orange-400 drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]'}`}>
              {effectType === 'homerun' ? '全垒打!' : '打枪!'}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {settlement.players.filter(p => effectType === 'homerun' ? p.homerun : p.gunsFired > 0).map(p => (
                <span key={p.userId} className="text-sm font-bold text-white/80 bg-white/10 px-3 py-1 rounded-full">
                  {getName(p.userId)}
                  {effectType === 'gun' && p.gunsFired > 1 ? ` x${p.gunsFired}` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 公共牌缩略显示（用于标题栏） ──────────────────────────────

export const PublicCardsThumbnail: React.FC<{
  publicCards: string[]; ghostCount: number; isHost: boolean;
  onEdit: () => void;
}> = ({ publicCards, ghostCount, isHost, onEdit }) => {
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
};

// ─── 公共牌中间区域显示（用于2/3人桌） ──────────────────────────

export const PublicCardsCenter: React.FC<{
  publicCards: string[]; publicCardsSet: boolean; ghostCount: number;
  isHost: boolean; confirmedCount: number; totalPlayers: number;
  onEdit: () => void; size?: 'normal' | 'large';
}> = ({ publicCards, publicCardsSet, ghostCount, isHost, confirmedCount, totalPlayers, onEdit, size = 'normal' }) => {
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
};

// ─── 自己的摆牌区域 ──────────────────────────────────────────

export const MyHandArea: React.FC<{
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
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void;
  cardSize?: 'small' | 'default' | 'large';
  avatarSize?: string;
  textSize?: string;
}> = ({ me, gameCreatedBy, playerTotals, myHeadCards, myMidCards, myTailCards, isConfirmed, publicCardsSet, activeLane, setActiveLane, setShowPicker, handleRemoveCard, showToast, cardSize = 'small', avatarSize = 'w-8 h-8', textSize = 'text-xs' }) => {
  const score = me ? (playerTotals[me.user_id] || 0) : 0;

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
          const count = lane === 'head' ? 3 : 5;
          const label = lane === 'head' ? '头道' : lane === 'mid' ? '中道' : '尾道';
          const canPick = !isConfirmed && publicCardsSet;
          const isSmall = cardSize === 'small';
          const isLarge = cardSize === 'large';
          return (
            <div key={lane} className="flex items-center gap-1">
              <span className={`${isSmall ? 'text-[9px] w-7' : 'text-[10px] w-8'} text-slate-500 text-right font-medium`}>{label}</span>
              <div className={`flex ${isSmall ? 'gap-0.5' : 'gap-1'}`}>
                {Array(count).fill(null).map((_, i) => {
                  const card = cards[i];
                  return card
                    ? <PokerCard key={card} card={card} faceUp small={isSmall} large={isLarge} onClick={() => !isConfirmed && handleRemoveCard(card)} />
                    : <PokerCard key={`${lane}-${i}`} small={isSmall} large={isLarge} onClick={canPick ? () => { setActiveLane(lane); setShowPicker(true); } : (!isConfirmed && !publicCardsSet ? () => showToast('请等待房主设置公共牌', 'info') : undefined)} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ─── 底部操作栏 ──────────────────────────────────────────────

export const BottomActionBar: React.FC<{
  isConfirmed: boolean; isSubmitting: boolean; isSettling: boolean;
  allSelectedCount: number; confirmedCount: number; totalPlayers: number;
  onRearrange: () => void; onAutoArrange: () => void; isAutoArranging: boolean; onSubmit: () => void;
  onForceSettle?: () => void;
}> = ({ isConfirmed, isSubmitting, isSettling, allSelectedCount, confirmedCount, totalPlayers, onRearrange, onAutoArrange, isAutoArranging, onSubmit, onForceSettle }) => (
  <div className="p-3 pb-8 flex flex-col gap-2 shrink-0 bg-black/20 border-t border-white/5">
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
);

// ─── 旁观者底部栏 ──────────────────────────────────────────────

export const SpectatorBar: React.FC<{
  confirmedCount: number; totalPlayers: number;
}> = ({ confirmedCount, totalPlayers }) => (
  <div className="p-3 pb-8 flex gap-3 shrink-0 bg-black/20 border-t border-white/5">
    <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10">
      <span className="material-symbols-outlined text-slate-400 text-xl">visibility</span>
      <span className="text-slate-400 font-bold">旁观中 · {confirmedCount}/{totalPlayers} 已确认</span>
    </div>
  </div>
);

// ─── 弹层集合 ──────────────────────────────────────────────────

export const GameModals: React.FC<{
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
  handleSelectCard: (card: string) => void; handleRemoveCard: (card: string) => void;
  handleSetPublicCards: (cards: string[]) => void;
  handleCompareClose: () => void; handleCloseRoom: () => void;
  toast: { msg: string; type: 'info' | 'error' | 'success' } | null;
}> = (p) => (
  <>
    {p.showPicker && (
      <CardPickerModal ghostCount={p.game.thirteen_ghost_count || 6} selectedCards={p.allSelectedCards}
        activeLane={p.activeLane} headCards={p.myHeadCards} midCards={p.myMidCards} tailCards={p.myTailCards}
        publicCards={p.publicCards}
        onSelectCard={p.handleSelectCard} onRemoveCard={p.handleRemoveCard} onSwitchLane={p.setActiveLane} onClose={() => p.setShowPicker(false)} />
    )}
    {p.showScoreBoard && (
      <ScoreBoard gameId={p.game.id} gameName={p.game.name} players={p.players} playerTotals={p.playerTotals} finishedRounds={p.finishedRounds}
        isHost={p.isHost} userId={p.userId} onClose={() => p.setShowScoreBoard(false)} onCloseRoom={p.handleCloseRoom} />
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
      onConfirm={p.handleSetPublicCards} onClose={() => p.setShowGhostPicker(false)} />}
    {p.showCompare && p.roundResult && (
      <CompareAnimation result={p.roundResult} players={p.players} userId={p.userId} onClose={p.handleCompareClose} />
    )}
    {p.toast && (
      <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${p.toast.type === 'error' ? 'bg-red-500 text-white' : p.toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>{p.toast.msg}</div>
    )}
  </>
);
