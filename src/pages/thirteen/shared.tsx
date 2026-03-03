import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  handleSubmitHand: () => void;
  handleSetPublicCards: (cards: string[]) => void;
  handleCompareClose: () => void;
  handleCloseRoom: () => void;
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

  const url = cardToUrl(card);
  if (url) {
    return (
      <div onClick={onClick}
        className={`${w} rounded-lg overflow-hidden shadow-sm bg-white ${onClick ? 'cursor-pointer active:scale-95' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}>
        <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const displayRank = RANK_DISPLAY[rank] || rank;
  const symbol = SUIT_SYMBOL[suit] || '?';
  const color = SUIT_COLOR[suit] || '';
  return (
    <div onClick={onClick} className={`${w} rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center ${onClick ? 'cursor-pointer active:scale-95' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}>
      <span className={`${small ? 'text-[10px]' : 'text-sm'} font-black ${color} leading-none`}>{displayRank}</span>
      <span className={`${small ? 'text-[8px]' : 'text-[11px]'} ${color} leading-none`}>{symbol}</span>
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
            const url = cardToUrl(card);
            const isJoker = card.startsWith('JK');
            return (
              <div key={i} onClick={() => toggle(card)} className={`w-[38px] h-[52px] rounded-md overflow-hidden bg-white shadow-md cursor-pointer active:scale-90 transition-transform ${isJoker ? 'ring-2 ring-purple-400/50' : ''}`}>
                {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
              </div>
            );
          })}
          {selected.length === 0 && <span className="text-xs text-slate-500 py-4">点击下方卡牌选择公共牌</span>}
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
                const url = cardToUrl(card);
                return (
                  <button key={card} onClick={() => toggle(card)}
                    className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected ? 'border-primary ring-2 ring-primary/60 scale-[0.92]' : isFull ? 'border-transparent opacity-30 cursor-not-allowed' : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer'}`}>
                    {url && <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" />}
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
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalSelected >= 13 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-400'}`}>
              {totalSelected}/13
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
        </div>
        <div className="flex gap-1.5 mb-3">
          {(['tail', 'mid', 'head'] as const).map(lane => {
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
                const isDisabled = isPublic || inOtherLane || (!inCurrentLane && (totalSelected >= 13 || currentLaneFull));
                const url = cardToUrl(card);
                return (
                  <button key={card} disabled={isDisabled && !inCurrentLane}
                    onClick={() => inCurrentLane ? onRemoveCard(card) : !isDisabled ? handleSelect(card) : undefined}
                    className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all relative
                      ${inCurrentLane ? 'border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/20 scale-[0.92]'
                        : isPublic ? 'border-amber-500/30 opacity-25 cursor-not-allowed'
                        : inOtherLane ? 'border-transparent opacity-20 cursor-not-allowed grayscale'
                        : isDisabled ? 'border-transparent opacity-30 cursor-not-allowed'
                        : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer shadow-sm hover:shadow-md'}`}>
                    {url && <img src={url} alt={card} className="w-full h-full object-contain" loading="lazy" />}
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
                  const isDisabled = inOtherLane || (!inCurrentLane && (totalSelected >= 13 || currentLaneFull));
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
  gameId: string; players: Player[]; playerTotals: Record<string, number>;
  finishedRounds: number; isHost: boolean; userId?: string;
  onClose: () => void; onCloseRoom: () => void;
}> = ({ gameId, players, playerTotals, finishedRounds, isHost, userId, onClose, onCloseRoom }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

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

  const sorted = players
    .map(p => ({ ...p, total: playerTotals[p.user_id] || 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="bg-background-dark flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 shrink-0">
          <h2 className="text-lg font-bold text-white">积分账单</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <span className="material-symbols-outlined text-white">close</span>
          </button>
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
                  <div key={round.id} className="bg-surface-dark rounded-xl border border-white/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400">第 {round.round_number} 局</span>
                      {round.ghost_count > 0 && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">鬼x{round.ghost_count} ({round.ghost_multiplier}倍)</span>}
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
    </div>
  );
};

// ─── 逐道比牌动画 ──────────────────────────────────────────

export const CompareAnimation: React.FC<{
  result: RoundResult; players: Player[]; userId?: string; onClose: () => void; replay?: boolean;
}> = ({ result, players, userId, onClose, replay = false }) => {
  const { settlement, hands, ghostCount, ghostMultiplier, roundNumber } = result;
  const playerMap: Record<string, Player> = {};
  for (const p of players) playerMap[p.user_id] = p;

  const [phase, setPhase] = useState(replay ? 3 : -1);
  const [laneRevealed, setLaneRevealed] = useState<boolean[]>(replay ? [true, true, true] : [false, false, false]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const laneNames: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
  const laneLabels = ['头道', '中道', '尾道'];

  const pairScores: Record<string, Record<string, number>> = { head: {}, mid: {}, tail: {} };
  for (const sp of settlement.players) {
    for (const ls of sp.laneScores) {
      if (ls.lane === 'head' || ls.lane === 'mid' || ls.lane === 'tail') {
        const key = `${ls.userId}_${ls.opponentId}`;
        pairScores[ls.lane][key] = ls.score;
      }
    }
  }

  useEffect(() => {
    if (replay) return;
    timerRef.current = setTimeout(() => setPhase(0), 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [replay]);

  useEffect(() => {
    if (replay) return;
    if (phase < 0 || phase > 2) return;
    setLaneRevealed(prev => { const n = [...prev]; n[phase] = true; return n; });
    if (phase < 2) {
      timerRef.current = setTimeout(() => setPhase(phase + 1), 2000);
    } else {
      timerRef.current = setTimeout(() => setPhase(3), 2000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, replay]);

  const sorted = [...settlement.players].sort((a, b) => b.finalScore - a.finalScore);

  const getLaneTotal = (uid: string, lane: string): number => {
    return settlement.players
      .find(p => p.userId === uid)
      ?.laneScores.filter(ls => ls.lane === lane && ls.userId === uid)
      .reduce((s, ls) => s + ls.score, 0) || 0;
  };

  const skipToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLaneRevealed([true, true, true]);
    setPhase(3);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col overflow-hidden" onClick={!replay && phase < 3 ? skipToEnd : undefined}>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-12 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">第 {roundNumber} 局</span>
            {ghostCount > 0 && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg font-bold">
                鬼x{ghostCount} {ghostMultiplier}倍
              </span>
            )}
          </div>
          {(phase >= 3 || replay) && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          )}
        </div>
        <div className="flex-1 px-3 pt-2 pb-4 space-y-4">
          {laneNames.map((lane, laneIdx) => {
            const revealed = laneRevealed[laneIdx];
            const isActive = phase === laneIdx;
            const cardCount = lane === 'head' ? 3 : 5;
            return (
              <div key={lane}
                className={`rounded-2xl border p-3 transition-all duration-500
                  ${isActive ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' : revealed ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isActive ? 'text-primary' : revealed ? 'text-slate-400' : 'text-slate-600'}`}>
                    {laneLabels[laneIdx]}
                  </span>
                  {revealed && isActive && (
                    <span className="text-[10px] text-primary animate-pulse font-bold">比牌中...</span>
                  )}
                </div>
                <div className="space-y-2">
                  {sorted.map(sp => {
                    const hand = hands.find(h => h.user_id === sp.userId);
                    const cards = hand ? (lane === 'head' ? hand.head_cards : lane === 'mid' ? hand.mid_cards : hand.tail_cards) : null;
                    const name = playerMap[sp.userId]?.users?.username || '?';
                    const isMe = sp.userId === userId;
                    const laneScore = getLaneTotal(sp.userId, lane);
                    return (
                      <div key={sp.userId}
                        className={`flex items-center gap-2 p-2 rounded-xl transition-all duration-500
                          ${isMe ? 'bg-primary/10' : 'bg-white/[0.02]'}`}>
                        <div className="w-14 shrink-0">
                          <span className={`text-[10px] font-bold truncate block ${isMe ? 'text-primary' : 'text-slate-400'}`}>{name}</span>
                        </div>
                        <div className="flex gap-0.5 flex-1 justify-center">
                          {revealed && cards
                            ? cards.map((c, i) => (
                              <div key={i} className="transition-all duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                <PokerCard card={c} faceUp small />
                              </div>
                            ))
                            : Array(cardCount).fill(null).map((_, i) => <CardBack key={i} small />)
                          }
                        </div>
                        <div className="w-12 text-right shrink-0">
                          {revealed ? (
                            <span className={`text-sm font-black transition-all duration-500
                              ${laneScore > 0 ? 'text-emerald-400' : laneScore < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                              {laneScore > 0 ? `+${laneScore}` : laneScore}
                            </span>
                          ) : <span className="text-sm text-slate-600">?</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {phase >= 3 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 animate-[fadeIn_0.5s_ease-out]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-400">最终结算</span>
                {ghostMultiplier > 1 && <span className="text-[10px] text-purple-400">鬼牌 {ghostMultiplier}x</span>}
              </div>
              {sorted.map((sp, idx) => {
                const name = playerMap[sp.userId]?.users?.username || '?';
                const isMe = sp.userId === userId;
                const hand = hands.find(h => h.user_id === sp.userId);
                return (
                  <div key={sp.userId} className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.03] border-white/5'}`}>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${idx === 0 && sp.finalScore > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500'}`}>{idx + 1}</span>
                    <Avatar username={name} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white truncate block">{name}{isMe ? ' (我)' : ''}</span>
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
      {phase >= 3 && (
        <div className="p-4 pb-8 shrink-0">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-base shadow-lg shadow-primary/30 transition-all active:scale-[0.98]">
            继续
          </button>
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
          const url = cardToUrl(card);
          const isJoker = card.startsWith('JK');
          return (
            <div key={i} className={`w-[29px] h-[40px] rounded-[3px] overflow-hidden bg-white shadow-sm ${isJoker ? 'ring-1 ring-purple-400/40' : ''}`}>
              {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
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
              const url = cardToUrl(card);
              const isJoker = card.startsWith('JK');
              return (
                <div key={i} className={`${cardW} rounded-md overflow-hidden bg-white shadow-md ${isJoker ? 'ring-2 ring-purple-400/50' : 'ring-1 ring-white/10'}`}>
                  {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
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
  onRearrange: () => void; onSubmit: () => void;
}> = ({ isConfirmed, isSubmitting, isSettling, allSelectedCount, confirmedCount, totalPlayers, onRearrange, onSubmit }) => (
  <div className="p-3 pb-8 flex gap-3 shrink-0 bg-black/20 border-t border-white/5">
    {!isConfirmed ? (
      <>
        <button onClick={onRearrange} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98]">
          重新摆牌
        </button>
        <button disabled={allSelectedCount < 13 || isSubmitting} onClick={onSubmit}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-40">
          {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : null}
          {isSubmitting ? '提交中...' : `确认摆牌 (${allSelectedCount}/13)`}
        </button>
      </>
    ) : (
      <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10">
        <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
        <span className="text-emerald-400 font-bold">
          {isSettling ? '正在结算...' : `已确认，等待其他玩家... (${confirmedCount}/${totalPlayers})`}
        </span>
      </div>
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
  game: { id: string; room_code: string; thirteen_ghost_count?: number };
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
      <ScoreBoard gameId={p.game.id} players={p.players} playerTotals={p.playerTotals} finishedRounds={p.finishedRounds}
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
