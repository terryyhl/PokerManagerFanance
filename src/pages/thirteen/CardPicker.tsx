import React, { useState, useMemo, memo } from 'react';
import { SUITS, RANKS, SUIT_COLOR, SUIT_SYMBOL, RANK_DISPLAY, cardToUrl } from './types';
import { PokerCard } from './PokerCard';

// ─── 常量 ─────────────────────────────────────────────────────
const LANE_MAX = { head: 3, mid: 5, tail: 5 } as const;
const LANE_LABELS = { head: '头道', mid: '中道', tail: '尾道' } as const;
const SLOTS_3 = [null, null, null] as const;
const SLOTS_5 = [null, null, null, null, null] as const;
const LANE_SLOTS = { head: SLOTS_3, mid: SLOTS_5, tail: SLOTS_5 } as const;

// ─── 公共牌选牌器 ──────────────────────────────────────────────

export const PublicCardPickerModal = memo<{
  maxCards: number; maxGhosts: number; initialCards: string[];
  onConfirm: (cards: string[]) => void; onClose: () => void;
}>(function PublicCardPickerModal({ maxCards, maxGhosts, initialCards, onConfirm, onClose }) {
  const [selected, setSelected] = useState<string[]>(initialCards);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
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
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
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
});

// ─── 选牌弹层 ────────────────────────────────────────────────

export const CardPickerModal = memo<{
  ghostCount: number; selectedCards: string[]; activeLane: 'head' | 'mid' | 'tail';
  headCards: string[]; midCards: string[]; tailCards: string[];
  publicCards: string[];
  onSelectCard: (card: string) => void; onRemoveCard: (card: string) => void;
  onSwitchLane: (lane: 'head' | 'mid' | 'tail') => void; onClose: () => void;
}>(function CardPickerModal({ ghostCount, selectedCards, activeLane, headCards, midCards, tailCards, publicCards, onSelectCard, onRemoveCard, onSwitchLane, onClose }) {
  const laneCards = useMemo(() => ({ head: headCards, mid: midCards, tail: tailCards }), [headCards, midCards, tailCards]);
  const currentLaneCards = laneCards[activeLane];
  const currentLaneFull = currentLaneCards.length >= LANE_MAX[activeLane];
  const currentLaneSet = useMemo(() => new Set(currentLaneCards), [currentLaneCards]);
  const otherLaneCards = useMemo(() => new Set(
    (['head', 'mid', 'tail'] as const).filter(l => l !== activeLane).flatMap(l => laneCards[l])
  ), [activeLane, laneCards]);
  const publicSet = useMemo(() => new Set(publicCards), [publicCards]);

  const autoSwitchLane = () => {
    const order: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
    for (const l of order) {
      if (l !== activeLane && laneCards[l].length < LANE_MAX[l]) {
        onSwitchLane(l);
        return;
      }
    }
  };

  const handleSelect = (card: string) => {
    onSelectCard(card);
    if (currentLaneCards.length + 1 >= LANE_MAX[activeLane]) {
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
            const isFull = laneCards[lane].length >= LANE_MAX[lane];
            return (
              <button key={lane} onClick={() => onSwitchLane(lane)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all relative
                  ${activeLane === lane ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : isFull ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}>
                <span>{LANE_LABELS[lane]}</span>
                <span className="ml-1 text-[10px] opacity-70">{laneCards[lane].length}/{LANE_MAX[lane]}</span>
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
          {LANE_SLOTS[activeLane].map((_, i) => {
            const card = currentLaneCards[i];
            return card
              ? <PokerCard key={card} card={card} faceUp cardId={card} onCardClick={onRemoveCard} />
              : <PokerCard key={`empty-${i}`} />;
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
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
});
