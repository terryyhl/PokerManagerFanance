import React, { memo } from 'react';
import { Player } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { RANK_DISPLAY, SUIT_SYMBOL, SUIT_COLOR, CARD_BACK_URL, cardToUrl } from './types';

// ─── 常量：牌背占位数组 ──────────────────────────────────────────
const SLOTS_3 = Array(3).fill(null);
const SLOTS_5 = Array(5).fill(null);

// ─── 牌面显示组件 ──────────────────────────────────────────────

export const PokerCard = memo<{
  card?: string; faceUp?: boolean; small?: boolean; large?: boolean; onClick?: () => void; selected?: boolean;
}>(function PokerCard({ card, faceUp = true, small = false, large = false, onClick, selected = false }) {
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
});

// ─── 牌背组件 ──────────────────────────────────────────────────

export const CardBack = memo<{ small?: boolean; large?: boolean }>(function CardBack({ small = false, large = false }) {
  const w = large ? 'w-[52px] h-[72px]' : small ? 'w-8 h-[44px]' : 'w-[46px] h-[64px]';
  return (
    <div className={`${w} rounded-lg overflow-hidden shadow-sm bg-red-900/20`}>
      <img src={CARD_BACK_URL} alt="back" className="w-full h-full object-fill rounded-lg" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} />
    </div>
  );
});

// ─── 对手牌区 ──────────────────────────────────────────────────

export const OpponentArea = memo<{
  player: Player; isPlayerHost: boolean; confirmed: boolean; score: number;
}>(function OpponentArea({ player, isPlayerHost, confirmed, score }) {
  const name = player.users?.username || '?';

  const renderLane = (slots: null[]) => (
    <div className="flex gap-0.5">
      {slots.map((_, i) => <CardBack key={i} small />)}
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
        {renderLane(SLOTS_3)}
        {renderLane(SLOTS_5)}
        {renderLane(SLOTS_5)}
        {confirmed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px]">
            <span className="text-xl font-black text-blue-400 drop-shadow-lg">OK</span>
          </div>
        )}
      </div>
    </div>
  );
});
