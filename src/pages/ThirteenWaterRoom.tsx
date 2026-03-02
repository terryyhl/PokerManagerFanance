import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { gamesApi, Game, Player } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';

interface ThirteenWaterRoomProps {
  forcedId: string;
}

// ─── 常量 ────────────────────────────────────────────────────────

const SUITS = ['S', 'H', 'C', 'D'] as const;
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };
const SUIT_COLOR: Record<string, string> = { S: 'text-slate-900', H: 'text-red-500', C: 'text-slate-900', D: 'text-red-500' };
const RANK_DISPLAY: Record<string, string> = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const SPECIAL_HAND_NAMES: Record<string, string> = {
  dragon: '青龙', straight_dragon: '一条龙', six_pairs: '六对半',
  three_flush: '三同花', three_straight: '三顺子',
};

// CDN 牌面图片 — hayeah/playing-cards-assets via jsDelivr
// 命名: {rank}_of_{suit}.svg — e.g. ace_of_spades.svg, 10_of_hearts.svg
// 大小王: black_joker.svg, red_joker.svg
const CARD_CDN = 'https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/svg-cards';
const CARD_BACK_URL = 'https://cdn.jsdelivr.net/gh/hayeah/playing-cards-assets@master/png/back.png';

const RANK_TO_NAME: Record<string, string> = {
  'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king',
};
const SUIT_TO_NAME: Record<string, string> = {
  'S': 'spades', 'H': 'hearts', 'C': 'clubs', 'D': 'diamonds',
};

/** 将内部牌码 (AS, TH, JK1..JK6) 转为 CDN URL */
function cardToUrl(card: string): string | null {
  if (card.startsWith('JK')) {
    // JK1,JK2,JK3 = 大王(black_joker), JK4,JK5,JK6 = 小王(red_joker)
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

interface RoundState {
  id: string;
  status: string;
  round_number: number;
  public_cards: string[];
  ghost_count: number;
  ghost_multiplier: number;
}

interface HandState {
  user_id: string;
  head_cards: string[] | null;
  mid_cards: string[] | null;
  tail_cards: string[] | null;
  is_confirmed: boolean;
  is_foul: boolean;
  special_hand: string | null;
  users?: { id: string; username: string };
}

interface GameState {
  activeRound: RoundState | null;
  hands: HandState[];
  finishedRounds: number;
  playerTotals: Record<string, number>;
}

interface LaneScoreRecord {
  lane: string;
  userId: string;
  opponentId: string;
  score: number;
  detail: string;
}

interface SettlementPlayer {
  userId: string;
  rawScore: number;
  finalScore: number;
  gunsFired: number;
  homerun: boolean;
  laneScores: LaneScoreRecord[];
}

interface SettlementResult {
  players: SettlementPlayer[];
}

interface RoundResult {
  settlement: SettlementResult;
  hands: HandState[];
  ghostCount: number;
  ghostMultiplier: number;
  roundNumber: number;
}

// ─── 牌面显示组件（CDN 图片版） ──────────────────────────────────

const PokerCard: React.FC<{
  card?: string; faceUp?: boolean; small?: boolean; onClick?: () => void; selected?: boolean;
}> = ({ card, faceUp = true, small = false, onClick, selected = false }) => {
  const w = small ? 'w-9 h-[50px]' : 'w-[46px] h-[64px]';

  // 空槽位
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

  // CDN 图片渲染（标准牌 + 大小王）
  const url = cardToUrl(card);
  if (url) {
    return (
      <div onClick={onClick}
        className={`${w} rounded-lg overflow-hidden shadow-sm bg-white ${onClick ? 'cursor-pointer active:scale-95' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background-dark' : ''}`}>
        <img src={url} alt={card}
          className="w-full h-full object-contain" loading="lazy" />
      </div>
    );
  }

  // Fallback — 文字渲染（不应该触发）
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
const CardBack: React.FC<{ small?: boolean }> = ({ small = false }) => {
  const w = small ? 'w-8 h-[44px]' : 'w-[46px] h-[64px]';
  return (
    <div className={`${w} rounded-lg overflow-hidden shadow-sm`}>
      <img src={CARD_BACK_URL} alt="back" className="w-full h-full object-cover rounded-lg" loading="lazy" />
    </div>
  );
};

// ─── 公共牌选牌器 ──────────────────────────────────────────────

const PublicCardPickerModal: React.FC<{
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
      // 检查鬼牌上限
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
        </div>

        {/* 已选公共牌展示 */}
        <div className="flex gap-1.5 justify-center min-h-[68px] items-center bg-white/[0.02] rounded-xl py-2 px-1 mb-3">
          {Array(maxCards).fill(null).map((_, i) => {
            const card = selected[i];
            return card
              ? <PokerCard key={card} card={card} faceUp onClick={() => toggle(card)} />
              : <PokerCard key={`slot-${i}`} />;
          })}
        </div>

        {/* 信息栏 */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-[10px]">
            {ghostsInSelected > 0 ? (
              <span className="text-purple-400 font-bold">鬼牌 {ghostsInSelected}张 · {ghostMultiplier}倍</span>
            ) : (
              <span className="text-slate-500">公共牌中的鬼牌会触发倍率加成</span>
            )}
          </div>
          <div className="flex gap-2">
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
                清除
              </button>
            )}
            <button onClick={() => onConfirm(selected)}
              className="text-xs font-bold text-white bg-primary hover:bg-primary/80 px-4 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm shadow-primary/30">
              确认
            </button>
          </div>
        </div>
      </div>

      {/* 牌面网格 */}
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
                const isSelected = selectedSet.has(card);
                const isDisabled = !isSelected && isFull;
                const url = cardToUrl(card);
                return (
                  <button key={card} disabled={isDisabled}
                    onClick={() => toggle(card)}
                    className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20 scale-[0.92]'
                        : isDisabled
                          ? 'border-transparent opacity-30 cursor-not-allowed'
                          : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer shadow-sm hover:shadow-md'}`}>
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
            <span className="text-[10px] text-purple-400/60">大小王 (鬼牌 · 触发倍率)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }, (_, i) => `JK${i + 1}`).map(card => {
              const isSelected = selectedSet.has(card);
              const ghostFull = ghostsInSelected >= maxGhosts;
              const isDisabled = !isSelected && (isFull || (card.startsWith('JK') && ghostFull));
              const num = parseInt(card.slice(2));
              const isBlack = num <= 3;
              const url = cardToUrl(card);
              return (
                <button key={card} disabled={isDisabled}
                  onClick={() => toggle(card)}
                  className={`aspect-[2/3] w-[calc((100%-6*6px)/7)] rounded-lg overflow-hidden border-2 transition-all relative
                    ${isSelected
                      ? 'border-purple-400 ring-2 ring-purple-400/60 shadow-lg shadow-purple-500/20 scale-[0.92]'
                      : isDisabled
                        ? 'border-transparent opacity-30 cursor-not-allowed'
                        : 'border-transparent hover:scale-[1.06] active:scale-[0.92] cursor-pointer shadow-sm hover:shadow-md'}`}>
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

// ─── 对手牌区 ──────────────────────────────────────────────────

type Position = 'top' | 'left' | 'right';

const OpponentArea: React.FC<{
  player: Player; isPlayerHost: boolean; position: Position; confirmed: boolean; score: number;
}> = ({ player, isPlayerHost, position, confirmed, score }) => {
  const name = player.users?.username || '?';
  const isVertical = position === 'top';
  const renderLane = (count: number, label: string) => (
    <div className="flex items-center gap-0.5">
      <span className="text-[8px] text-slate-600 w-5 text-right shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {Array(count).fill(null).map((_, i) => (
          <CardBack key={i} small />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center' : position === 'left' ? 'flex-row items-center' : 'flex-row-reverse items-center'} gap-2`}>
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <Avatar username={name} isAdmin={isPlayerHost} className="w-9 h-9" />
        <span className="text-[10px] font-bold text-white truncate max-w-[60px]">{name}</span>
        <span className={`text-[10px] font-black ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-500'}`}>
          {score > 0 ? `+${score}` : score}
        </span>
      </div>
      <div className={`flex flex-col gap-1 relative ${!isVertical ? 'scale-[0.75] origin-center' : ''}`}>
        {renderLane(3, '头')}
        {renderLane(5, '中')}
        {renderLane(5, '尾')}
        {confirmed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px]">
            <span className="text-2xl font-black text-blue-400 drop-shadow-lg">OK</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 选牌弹层 ────────────────────────────────────────────────

const CardPickerModal: React.FC<{
  ghostCount: number; selectedCards: string[]; activeLane: 'head' | 'mid' | 'tail';
  headCards: string[]; midCards: string[]; tailCards: string[];
  publicCards: string[];
  onSelectCard: (card: string) => void; onRemoveCard: (card: string) => void;
  onSwitchLane: (lane: 'head' | 'mid' | 'tail') => void; onClose: () => void;
}> = ({ ghostCount, selectedCards, activeLane, headCards, midCards, tailCards, publicCards, onSelectCard, onRemoveCard, onSwitchLane, onClose }) => {
  const laneMax = { head: 3, mid: 5, tail: 5 };
  const laneCards = { head: headCards, mid: midCards, tail: tailCards };
  const laneLabels = { head: '头道', mid: '中道', tail: '尾道' };
  const laneIcons = { head: 'looks_3', mid: 'looks_5', tail: 'looks_5' };
  const currentLaneCards = laneCards[activeLane];
  const currentLaneFull = currentLaneCards.length >= laneMax[activeLane];
  // 当前道已选的牌（可以点击取消）
  const currentLaneSet = new Set(currentLaneCards);
  // 其他道已选的牌（禁用）
  const otherLaneCards = new Set(
    (['head', 'mid', 'tail'] as const)
      .filter(l => l !== activeLane)
      .flatMap(l => laneCards[l])
  );
  // 公共牌集合（禁用）
  const publicSet = new Set(publicCards);

  // 自动切换到下一个未满的道
  const autoSwitchLane = () => {
    const order: Array<'head' | 'mid' | 'tail'> = ['tail', 'mid', 'head'];
    for (const l of order) {
      if (l !== activeLane && laneCards[l].length < laneMax[l]) {
        onSwitchLane(l);
        return;
      }
    }
  };

  // 选牌后如果当前道满了，自动切换
  const handleSelect = (card: string) => {
    onSelectCard(card);
    // 选完这张后当前道是否满了
    if (currentLaneCards.length + 1 >= laneMax[activeLane]) {
      setTimeout(autoSwitchLane, 100);
    }
  };

  const totalSelected = selectedCards.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* 顶部：道切换 + 当前道牌槽 */}
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

        {/* 三道切换标签 */}
        <div className="flex gap-1.5 mb-3">
          {(['tail', 'mid', 'head'] as const).map(lane => {
            const isFull = laneCards[lane].length >= laneMax[lane];
            return (
              <button key={lane} onClick={() => onSwitchLane(lane)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative
                  ${activeLane === lane
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : isFull
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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

        {/* 当前道牌槽 */}
        <div className="flex gap-1.5 justify-center min-h-[68px] items-center bg-white/[0.02] rounded-xl py-2 px-1">
          {Array(laneMax[activeLane]).fill(null).map((_, i) => {
            const card = currentLaneCards[i];
            return card
              ? <PokerCard key={card} card={card} faceUp onClick={() => onRemoveCard(card)} />
              : <PokerCard key={`empty-${i}`} />;
          })}
        </div>
      </div>

      {/* 牌面网格 */}
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
                // 公共牌或其他道已选的牌：禁用
                const isDisabled = isPublic || inOtherLane || (!inCurrentLane && (totalSelected >= 13 || currentLaneFull));
                const url = cardToUrl(card);
                return (
                  <button key={card} disabled={isDisabled && !inCurrentLane}
                    onClick={() => inCurrentLane ? onRemoveCard(card) : !isDisabled ? handleSelect(card) : undefined}
                    className={`aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all relative
                      ${inCurrentLane
                        ? 'border-primary ring-2 ring-primary/60 shadow-lg shadow-primary/20 scale-[0.92]'
                        : isPublic
                          ? 'border-amber-500/30 opacity-25 cursor-not-allowed'
                          : inOtherLane
                            ? 'border-transparent opacity-20 cursor-not-allowed grayscale'
                            : isDisabled
                              ? 'border-transparent opacity-30 cursor-not-allowed'
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
        {/* 鬼牌区域：只展示不在公共牌中的鬼牌 */}
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
                        ${inCurrentLane
                          ? 'border-purple-400 ring-2 ring-purple-400/60 shadow-lg shadow-purple-500/20 scale-[0.92]'
                          : inOtherLane
                            ? 'border-transparent opacity-20 cursor-not-allowed grayscale'
                            : isDisabled
                              ? 'border-transparent opacity-30 cursor-not-allowed'
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

const ScoreBoard: React.FC<{
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
                    <span className={`text-lg font-black ${p.total > 0 ? 'text-emerald-400' : p.total < 0 ? 'text-red-400' : 'text-slate-500'}`}>{p.total > 0 ? `+${p.total}` : p.total}</span>
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
                            <span className={`font-black ${t.final_score > 0 ? 'text-emerald-400' : t.final_score < 0 ? 'text-red-400' : 'text-slate-500'}`}>{t.final_score > 0 ? `+${t.final_score}` : t.final_score}</span>
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

// ─── 逐道比牌动画面板 ──────────────────────────────────────────

const CompareAnimation: React.FC<{
  result: RoundResult; players: Player[]; userId?: string; onClose: () => void;
}> = ({ result, players, userId, onClose }) => {
  const { settlement, hands, ghostCount, ghostMultiplier, roundNumber } = result;
  const playerMap: Record<string, Player> = {};
  for (const p of players) playerMap[p.user_id] = p;

  // 动画阶段: 0=头道, 1=中道, 2=尾道, 3=总分
  const [phase, setPhase] = useState(-1); // -1=初始黑屏
  const [laneRevealed, setLaneRevealed] = useState<boolean[]>([false, false, false]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 提取每对玩家每道的分数
  const laneNames: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
  const laneLabels = ['头道', '中道', '尾道'];

  // 构建每道每对的得分 map: pairScores[lane][`${userId}_${opponentId}`] = score
  const pairScores: Record<string, Record<string, number>> = { head: {}, mid: {}, tail: {} };
  for (const sp of settlement.players) {
    for (const ls of sp.laneScores) {
      if (ls.lane === 'head' || ls.lane === 'mid' || ls.lane === 'tail') {
        const key = `${ls.userId}_${ls.opponentId}`;
        pairScores[ls.lane][key] = ls.score;
      }
    }
  }

  // 自动推进动画
  useEffect(() => {
    // 开始时 0.5s 后翻头道
    timerRef.current = setTimeout(() => setPhase(0), 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase < 0 || phase > 2) return;
    // 翻牌
    setLaneRevealed(prev => { const n = [...prev]; n[phase] = true; return n; });
    // 自动下一道
    if (phase < 2) {
      timerRef.current = setTimeout(() => setPhase(phase + 1), 2000);
    } else {
      // 最后一道翻完后 2s 显示总分
      timerRef.current = setTimeout(() => setPhase(3), 2000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  const sorted = [...settlement.players].sort((a, b) => b.finalScore - a.finalScore);

  // 获取某玩家某道的得分总和（对所有对手）
  const getLaneTotal = (uid: string, lane: string): number => {
    return settlement.players
      .find(p => p.userId === uid)
      ?.laneScores.filter(ls => ls.lane === lane && ls.userId === uid)
      .reduce((s, ls) => s + ls.score, 0) || 0;
  };

  // 快进
  const skipToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLaneRevealed([true, true, true]);
    setPhase(3);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col overflow-hidden" onClick={phase < 3 ? skipToEnd : undefined}>
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">第 {roundNumber} 局</span>
            {ghostCount > 0 && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg font-bold">
                鬼x{ghostCount} {ghostMultiplier}倍
              </span>
            )}
          </div>
          {phase >= 3 && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          )}
        </div>

        {/* 逐道比牌区域 */}
        <div className="flex-1 px-3 pt-2 pb-4 space-y-4">
          {laneNames.map((lane, laneIdx) => {
            const revealed = laneRevealed[laneIdx];
            const isActive = phase === laneIdx;
            const cardCount = lane === 'head' ? 3 : 5;

            return (
              <div key={lane}
                className={`rounded-2xl border p-3 transition-all duration-500
                  ${isActive ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' : revealed ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-40'}`}>
                {/* 道名称 */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isActive ? 'text-primary' : revealed ? 'text-slate-400' : 'text-slate-600'}`}>
                    {laneLabels[laneIdx]}
                  </span>
                  {revealed && isActive && (
                    <span className="text-[10px] text-primary animate-pulse font-bold">比牌中...</span>
                  )}
                </div>

                {/* 每个玩家的该道牌 */}
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
                        {/* 分数 */}
                        <div className="w-12 text-right shrink-0">
                          {revealed ? (
                            <span className={`text-sm font-black transition-all duration-500
                              ${laneScore > 0 ? 'text-emerald-400' : laneScore < 0 ? 'text-red-400' : 'text-slate-500'}`}>
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

          {/* 总分展示（phase=3） */}
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
                    <span className={`text-2xl font-black ${sp.finalScore > 0 ? 'text-emerald-400' : sp.finalScore < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {sp.finalScore > 0 ? `+${sp.finalScore}` : sp.finalScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
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

// ─── 主组件 ────────────────────────────────────────────────────

export default function ThirteenWaterRoom({ forcedId }: ThirteenWaterRoomProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const id = forcedId;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);

  // 游戏状态
  const [gamePhase, setGamePhase] = useState<'waiting' | 'arranging' | 'revealing' | 'settled'>('waiting');
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // 当前玩家的手牌
  const [myHeadCards, setMyHeadCards] = useState<string[]>([]);
  const [myMidCards, setMyMidCards] = useState<string[]>([]);
  const [myTailCards, setMyTailCards] = useState<string[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // 对手确认状态
  const [confirmedUsers, setConfirmedUsers] = useState<Set<string>>(new Set());

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
  const settlingRef = useRef(false); // 防止重复结算

  // 弹层
  const [showPicker, setShowPicker] = useState(false);
  const [activeLane, setActiveLane] = useState<'head' | 'mid' | 'tail'>('tail');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showScoreBoard, setShowScoreBoard] = useState(false);
  const [showGhostPicker, setShowGhostPicker] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      const state: GameState = await res.json();

      setPlayerTotals(state.playerTotals || {});
      setFinishedRounds(state.finishedRounds || 0);

      if (state.activeRound) {
        const round = state.activeRound;
        setCurrentRoundId(round.id);
        setPublicCards(round.public_cards || []);
        setGhostCount(round.ghost_count || 0);

        const confirmed = new Set<string>();
        for (const h of state.hands) {
          if (h.is_confirmed) confirmed.add(h.user_id);
        }
        setConfirmedUsers(confirmed);

        const myHand = state.hands.find(h => h.user_id === user.id);
        if (myHand && myHand.is_confirmed) {
          setMyHeadCards(myHand.head_cards || []);
          setMyMidCards(myHand.mid_cards || []);
          setMyTailCards(myHand.tail_cards || []);
          setIsConfirmed(true);
        }

        if (round.status === 'arranging') {
          setGamePhase('arranging');
        } else if (round.status === 'revealing') {
          setGamePhase('revealing');
        } else if (round.status === 'settled') {
          setGamePhase('settled');
        }
      } else {
        setGamePhase('waiting');
      }
    } catch { /* silent */ }
  }, [id, user]);

  // ─── 进入房间: 自动入座 + 同步进度 ────────────────────────
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const res = await fetchGame();
      if (cancelled || !res) return;

      const alreadyIn = res.players.some((p: Player) => p.user_id === user.id);
      if (!alreadyIn) {
        const max = res.game.thirteen_max_players || 4;
        if (res.players.length >= max) {
          showToast(`房间已满（${max}人）`, 'error');
        } else {
          try {
            await gamesApi.join(res.game.room_code, user.id);
            const updated = await gamesApi.get(id);
            if (!cancelled) {
              setGame(updated.game);
              setPlayers(updated.players);
              showToast('已入座', 'success');
            }
          } catch { showToast('入座失败', 'error'); }
        }
      }
      if (!cancelled) await syncGameState();
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

  // ─── 结算函数（提取出来供多处调用） ─────────────────────────
  const doSettle = useCallback(async () => {
    if (!game || !user || !currentRoundId || settlingRef.current) return;
    settlingRef.current = true;
    setIsSettling(true);
    try {
      const res = await fetch(`/api/thirteen/${game.id}/settle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, roundId: currentRoundId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 可能已被其他客户端结算
        if (data.error?.includes('已结算')) return;
        showToast(data.error || '结算失败', 'error');
        return;
      }
      // 获取详情用于比牌动画
      const detailRes = await fetch(`/api/thirteen/${game.id}/round/${currentRoundId}?_t=${Date.now()}`);
      const detailData = await detailRes.json();

      setRoundResult({
        settlement: data.settlement,
        hands: detailData.hands || [],
        ghostCount: detailData.round?.ghost_count || 0,
        ghostMultiplier: detailData.round?.ghost_multiplier || 1,
        roundNumber: detailData.round?.round_number || 0,
      });
      setShowCompare(true);
    } catch { showToast('网络错误', 'error'); }
    finally { setIsSettling(false); settlingRef.current = false; }
  }, [game, user, currentRoundId]);

  // ─── Supabase Realtime ──────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`thirteen-room:${id}`)
      // 新轮次 → 切换摆牌
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thirteen_rounds', filter: `game_id=eq.${id}` },
        (payload) => {
          const round = payload.new as RoundState;
          setCurrentRoundId(round.id);
          setPublicCards(round.public_cards || []);
          setGhostCount(round.ghost_count || 0);
          setGamePhase('arranging');
          setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
          setIsConfirmed(false);
          setConfirmedUsers(new Set());
          settlingRef.current = false;
        })
      // 轮次状态更新
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'thirteen_rounds', filter: `game_id=eq.${id}` },
        (payload) => {
          const round = payload.new as RoundState;
          setPublicCards(round.public_cards || []);
          setGhostCount(round.ghost_count || 0);
          if (round.status === 'finished') {
            // 非发起结算的客户端 → 也拉取结果显示比牌动画
            if (!showCompare && !settlingRef.current) {
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
                    ghostCount: round.ghost_count || 0,
                    ghostMultiplier: round.ghost_multiplier || 1,
                    roundNumber: round.round_number || 0,
                  });
                  setShowCompare(true);
                } catch { /* silent */ }
              })();
            }
          }
        })
      // 手牌提交 → 更新确认状态 + 检查是否全员确认
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thirteen_hands' },
        (payload) => {
          const hand = payload.new as HandState;
          if (hand && hand.is_confirmed) {
            setConfirmedUsers(prev => {
              const next = new Set(prev);
              next.add(hand.user_id);
              return next;
            });
          }
        })
      // 玩家加入
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` },
        () => { fetchGame(); })
      // 游戏结束（房间关闭）
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        (payload) => {
          const g = payload.new as { status: string };
          if (g.status === 'finished') {
            showToast('房间已关闭', 'info');
            setTimeout(() => navigate('/lobby'), 1500);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchGame, navigate, showCompare]);

  // ─── 全员确认后自动结算 ─────────────────────────────────────
  useEffect(() => {
    if (gamePhase === 'arranging' && confirmedUsers.size >= currentPlayers && currentPlayers >= 2 && !settlingRef.current) {
      // 任何客户端都可以触发结算
      doSettle();
    }
  }, [confirmedUsers.size, currentPlayers, gamePhase, doSettle]);

  // ─── 倒计时 ────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase === 'arranging' && game?.thirteen_time_limit) {
      setCountdown(game.thirteen_time_limit);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(null);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [gamePhase, game?.thirteen_time_limit]);

  // ─── 操作 ──────────────────────────────────────────────────
  const handleStartRound = async () => {
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
  };

  const handleSetPublicCards = async (cards: string[]) => {
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
  };

  const handleSubmitHand = async () => {
    if (!game || !user || !currentRoundId || isSubmitting) return;
    if (myHeadCards.length !== 3 || myMidCards.length !== 5 || myTailCards.length !== 5) {
      showToast('请先摆满13张牌', 'error'); return;
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
      setConfirmedUsers(prev => new Set(prev).add(user.id));
      if (data.isFoul) showToast('注意：你的摆牌被判定为乌龙！', 'error');
      else if (data.specialHand) showToast(`报到牌型: ${SPECIAL_HAND_NAMES[data.specialHand] || data.specialHand}!`, 'success');
      else showToast('已确认摆牌', 'success');
      // 自动结算由 useEffect 触发
    } catch { showToast('网络错误', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleCloseRoom = async () => {
    if (!game || !user) return;
    if (!confirm('确定要关闭房间吗？关闭后所有玩家将退出。')) return;
    try {
      await gamesApi.finish(game.id, user.id);
      showToast('房间已关闭', 'success');
      setTimeout(() => navigate('/lobby'), 1000);
    } catch { showToast('关闭失败', 'error'); }
  };

  const handleCompareClose = () => {
    setShowCompare(false);
    setRoundResult(null);
    setGamePhase('waiting');
    setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
    setIsConfirmed(false);
    setConfirmedUsers(new Set());
    setPublicCards([]);
    setGhostCount(0);
    settlingRef.current = false;
    syncGameState();
  };

  const allSelectedCards = [...myHeadCards, ...myMidCards, ...myTailCards];
  const laneMax = { head: 3, mid: 5, tail: 5 };

  const handleSelectCard = (card: string) => {
    if (allSelectedCards.length >= 13) return;
    const laneCards = activeLane === 'head' ? myHeadCards : activeLane === 'mid' ? myMidCards : myTailCards;
    if (laneCards.length >= laneMax[activeLane]) return;
    if (allSelectedCards.includes(card)) return;
    if (publicCards.includes(card)) return; // 排除公共牌
    if (activeLane === 'head') setMyHeadCards(prev => [...prev, card]);
    else if (activeLane === 'mid') setMyMidCards(prev => [...prev, card]);
    else setMyTailCards(prev => [...prev, card]);
  };

  const handleRemoveCard = (card: string) => {
    setMyHeadCards(prev => prev.filter(c => c !== card));
    setMyMidCards(prev => prev.filter(c => c !== card));
    setMyTailCards(prev => prev.filter(c => c !== card));
  };

  const handleRearrange = () => {
    setMyHeadCards([]); setMyMidCards([]); setMyTailCards([]);
    setIsConfirmed(false);
    showToast('已清空，重新摆牌', 'info');
  };

  const me = players.find(p => p.user_id === user?.id);
  const opponents = players.filter(p => p.user_id !== user?.id);

  const getOpponentPosition = (index: number, total: number): Position => {
    if (total === 1) return 'top';
    if (total === 2) return index === 0 ? 'left' : 'right';
    if (index === 0) return 'top';
    if (index === 1) return 'left';
    return 'right';
  };

  // ─── Header 组件 ────────────────────────────────────────────
  const RoomHeader: React.FC<{ showBack?: boolean; onBack?: () => void }> = ({ showBack = true, onBack }) => (
    <div className="flex items-center px-4 h-14 border-b border-white/5 shrink-0">
      {showBack && (
        <button onClick={onBack || (() => navigate('/lobby'))} className="mr-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
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
        <button onClick={() => setShowScoreBoard(true)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="积分账单">
          <span className="material-symbols-outlined text-[20px] text-slate-400">receipt_long</span>
        </button>
        <span className="text-[10px] font-mono text-slate-500">{game?.room_code}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (<div className="min-h-screen bg-background-dark flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
    </div>);
  }

  if (!game) {
    return (<div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-4 text-slate-500">
      <span className="material-symbols-outlined text-5xl">error</span>
      <p>房间不存在</p>
      <button onClick={() => navigate('/lobby')} className="text-primary font-bold">返回大厅</button>
    </div>);
  }

  // ─── 等待页面 ──────────────────────────────────────────────

  if (gamePhase === 'waiting') {
    return (
      <div className="min-h-screen bg-background-dark text-white flex flex-col">
        <RoomHeader />
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
                    <span className={`text-lg font-black ${total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-400' : 'text-slate-600'}`}>{total > 0 ? `+${total}` : total}</span>
                    <p className="text-[9px] text-slate-500">总分</p>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: maxPlayers - currentPlayers }).map((_, i) => (
              <button key={`empty-${i}`} onClick={() => setShowInvite(true)}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border-2 border-dashed border-white/10 min-h-[72px] hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.97] group cursor-pointer">
                <span className="material-symbols-outlined text-[24px] text-slate-600 group-hover:text-primary transition-colors">person_add</span>
                <span className="text-slate-600 group-hover:text-primary text-xs font-medium transition-colors">点击邀请</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center"><span className="text-4xl">🀄</span></div>
          <p className="text-slate-500 text-sm text-center">
            {currentPlayers < 2 ? '至少需要 2 名玩家才能开始' : isHost ? '点击下方按钮开始新一局' : '等待房主开始游戏...'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-500">
            <span className="bg-white/5 px-2 py-1 rounded">{game.thirteen_base_score || 1}分/水</span>
            <span className="bg-white/5 px-2 py-1 rounded">{game.thirteen_ghost_count || 6}鬼牌</span>
            {game.thirteen_compare_suit && <span className="bg-white/5 px-2 py-1 rounded">花色比较</span>}
            <span className="bg-white/5 px-2 py-1 rounded">{game.thirteen_time_limit || 90}s倒计时</span>
          </div>
        </div>

        {isHost && currentPlayers >= 2 && (
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
          <ScoreBoard gameId={id} players={players} playerTotals={playerTotals} finishedRounds={finishedRounds}
            isHost={isHost} userId={user?.id} onClose={() => setShowScoreBoard(false)} onCloseRoom={handleCloseRoom} />
        )}

        {toast && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>{toast.msg}</div>
        )}
      </div>
    );
  }

  // ─── 游戏进行中 ──────────────────────────────────────────────

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col overflow-hidden relative">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-3 h-12 bg-black/30 border-b border-white/5 shrink-0">
        <button onClick={() => setGamePhase('waiting')} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
        </button>
        {/* 房间信息 */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>{game.name}</span>
          {ghostCount > 0 && <span className="text-purple-400 font-bold">{Math.pow(2, ghostCount)}x</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowScoreBoard(true)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-[18px] text-slate-400">receipt_long</span>
          </button>
          {countdown !== null && countdown > 0 ? (
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm ${countdown <= 10 ? 'border-red-500 text-red-400' : countdown <= 30 ? 'border-amber-400 text-amber-400' : 'border-emerald-400 text-emerald-400'}`}>{countdown}s</div>
          ) : <div className="w-10" />}
        </div>
      </div>

      {/* 游戏主区域 */}
      <div className="flex-1 flex flex-col relative min-h-0">
        <div className="flex justify-center items-start pt-3 min-h-[120px]">
          {opponents.filter((_, i) => getOpponentPosition(i, opponents.length) === 'top').map(opp => (
            <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === game.created_by} position="top" confirmed={confirmedUsers.has(opp.user_id)} score={playerTotals[opp.user_id] || 0} />
          ))}
        </div>
        <div className="flex items-center justify-between px-1 flex-1 min-h-0">
          <div className="w-[85px] flex justify-center">
            {opponents.filter((_, i) => getOpponentPosition(i, opponents.length) === 'left').map(opp => (
              <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === game.created_by} position="left" confirmed={confirmedUsers.has(opp.user_id)} score={playerTotals[opp.user_id] || 0} />
            ))}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            {/* 公共牌区域 */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] text-slate-500 font-bold tracking-wider">公共牌</span>
              <div className="flex gap-1 items-center">
                {Array(6).fill(null).map((_, i) => {
                  const card = publicCards[i];
                  if (card) {
                    const url = cardToUrl(card);
                    const isJoker = card.startsWith('JK');
                    return (
                      <div key={i} className={`w-8 h-11 rounded-md overflow-hidden shadow-sm bg-white ${isJoker ? 'ring-1 ring-purple-400/50' : ''}`}>
                        {url && <img src={url} alt={card} className="w-full h-full object-contain" />}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`w-8 h-11 rounded-md border border-dashed flex items-center justify-center
                      ${isHost && publicCards.length === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
                      <span className="text-white/10 text-[8px]">?</span>
                    </div>
                  );
                })}
              </div>
              {ghostCount > 0 && (
                <span className="text-[10px] text-purple-400 font-bold">鬼×{ghostCount} · {Math.pow(2, ghostCount)}倍</span>
              )}
              {isHost && (
                <button onClick={() => setShowGhostPicker(true)}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all active:scale-95
                    ${publicCards.length === 0
                      ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 animate-pulse'
                      : 'text-slate-400 bg-white/5 hover:bg-white/10'}`}>
                  {publicCards.length === 0 ? '点击设置公共牌' : '修改公共牌'}
                </button>
              )}
              {!isHost && publicCards.length === 0 && (
                <span className="text-[10px] text-amber-400/70">等待房主设置公共牌...</span>
              )}
            </div>
            <span className="text-[9px] text-slate-500">{confirmedUsers.size}/{currentPlayers} 已确认</span>
          </div>
          <div className="w-[85px] flex justify-center">
            {opponents.filter((_, i) => getOpponentPosition(i, opponents.length) === 'right').map(opp => (
              <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === game.created_by} position="right" confirmed={confirmedUsers.has(opp.user_id)} score={playerTotals[opp.user_id] || 0} />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center pb-2 pt-2 border-t border-white/5">
          {me && (
            <div className="flex items-center gap-2 mb-2">
              <Avatar username={me.users?.username || '?'} isAdmin={me.user_id === game.created_by} className="w-8 h-8" />
              <span className="text-xs font-bold text-white">{me.users?.username || '?'}</span>
              <span className={`text-xs font-black ${(playerTotals[me.user_id] || 0) > 0 ? 'text-emerald-400' : (playerTotals[me.user_id] || 0) < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {(playerTotals[me.user_id] || 0) > 0 ? `+${playerTotals[me.user_id]}` : playerTotals[me.user_id] || 0}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1.5 items-center">
            {(['head', 'mid', 'tail'] as const).map(lane => {
              const cards = lane === 'head' ? myHeadCards : lane === 'mid' ? myMidCards : myTailCards;
              const count = lane === 'head' ? 3 : 5;
              const label = lane === 'head' ? '头道' : lane === 'mid' ? '中道' : '尾道';
              const canPick = !isConfirmed && publicCards.length > 0;
              return (
                <div key={lane} className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-500 w-8 text-right">{label}</span>
                  <div className="flex gap-1">
                    {Array(count).fill(null).map((_, i) => {
                      const card = cards[i];
                      return card
                        ? <PokerCard key={card} card={card} faceUp onClick={() => !isConfirmed && handleRemoveCard(card)} />
                        : <PokerCard key={`${lane}-${i}`} onClick={canPick ? () => { setActiveLane(lane); setShowPicker(true); } : (!isConfirmed && publicCards.length === 0 ? () => showToast('请等待房主设置公共牌', 'info') : undefined)} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-3 pb-8 flex gap-3 shrink-0 bg-black/20 border-t border-white/5">
        {!isConfirmed ? (
          <>
            <button onClick={handleRearrange} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98]">
              重新摆牌
            </button>
            <button disabled={allSelectedCards.length < 13 || isSubmitting} onClick={handleSubmitHand}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-40">
              {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : null}
              {isSubmitting ? '提交中...' : `确认摆牌 (${allSelectedCards.length}/13)`}
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            <span className="text-emerald-400 font-bold">
              {isSettling ? '正在结算...' : `已确认，等待其他玩家... (${confirmedUsers.size}/${currentPlayers})`}
            </span>
          </div>
        )}
      </div>

      {showPicker && (
        <CardPickerModal ghostCount={game.thirteen_ghost_count || 6} selectedCards={allSelectedCards}
          activeLane={activeLane} headCards={myHeadCards} midCards={myMidCards} tailCards={myTailCards}
          publicCards={publicCards}
          onSelectCard={handleSelectCard} onRemoveCard={handleRemoveCard} onSwitchLane={setActiveLane} onClose={() => setShowPicker(false)} />
      )}

      {showScoreBoard && (
        <ScoreBoard gameId={id} players={players} playerTotals={playerTotals} finishedRounds={finishedRounds}
          isHost={isHost} userId={user?.id} onClose={() => setShowScoreBoard(false)} onCloseRoom={handleCloseRoom} />
      )}

      {/* 公共牌选牌器 */}
      {showGhostPicker && <PublicCardPickerModal
        maxCards={6}
        maxGhosts={game.thirteen_ghost_count || 6}
        initialCards={publicCards}
        onConfirm={handleSetPublicCards}
        onClose={() => setShowGhostPicker(false)}
      />}

      {/* 比牌动画 */}
      {showCompare && roundResult && (
        <CompareAnimation result={roundResult} players={players} userId={user?.id} onClose={handleCompareClose} />
      )}

      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg ${toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
