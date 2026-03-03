import React from 'react';
import Avatar from '../../components/Avatar';
import {
  TableProps, PokerCard, CardBack, PublicCardsCenter, MyHandArea, BottomActionBar, GameModals,
  cardToUrl,
} from './shared';

/** 2人桌布局 — 上对手(放大) → 公共牌(中间放大) → 自己(放大) */
export const TwoPlayerTable: React.FC<TableProps> = (p) => {
  const topOpponent = p.opponents[0];

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col overflow-hidden relative">
      {/* 标题栏: 返回 + 房间名 + 按钮 */}
      <div className="flex items-center justify-between px-2 h-[58px] bg-black/30 border-b border-white/5 shrink-0">
        <button onClick={() => p.setGamePhase('waiting')} className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
          <span className="text-sm font-bold text-white truncate">{p.game.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => p.setShowInvite(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="房间密码">
            <span className="material-symbols-outlined text-[20px] text-slate-400">key</span>
          </button>
          <button onClick={() => p.setShowScoreBoard(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="积分账单">
            <span className="material-symbols-outlined text-[20px] text-slate-400">receipt_long</span>
          </button>
        </div>
      </div>

      {/* 游戏主区域 */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* 对手区域 (放大) */}
        {topOpponent && (() => {
          const oppName = topOpponent.users?.username || '?';
          const oppScore = p.playerTotals[topOpponent.user_id] || 0;
          const oppConfirmed = p.confirmedUsers.has(topOpponent.user_id);
          return (
            <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar username={oppName} isAdmin={topOpponent.user_id === p.game.created_by} className="w-10 h-10" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{oppName}</span>
                    <span className={`text-sm font-black ${oppScore > 0 ? 'text-emerald-400' : oppScore < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {oppScore > 0 ? `+${oppScore}` : oppScore}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 relative">
                  <div className="flex gap-1">{Array(3).fill(null).map((_, i) => <CardBack key={i} large />)}</div>
                  <div className="flex gap-1">{Array(5).fill(null).map((_, i) => <CardBack key={i} large />)}</div>
                  <div className="flex gap-1">{Array(5).fill(null).map((_, i) => <CardBack key={i} large />)}</div>
                  {oppConfirmed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px]">
                      <span className="text-3xl font-black text-blue-400 drop-shadow-lg">OK</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 公共牌区域 (中间放大) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <PublicCardsCenter
            publicCards={p.publicCards} publicCardsSet={p.publicCardsSet} ghostCount={p.ghostCount}
            isHost={p.isHost} confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers}
            onEdit={() => p.setShowGhostPicker(true)} size="large"
          />
        </div>

        {/* 自己区域 (放大) */}
        <div className="flex flex-col items-center pb-2 pt-2 border-t border-white/5 shrink-0">
          <MyHandArea me={p.me} isHost={p.isHost} gameCreatedBy={p.game.created_by}
            playerTotals={p.playerTotals} myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
            isConfirmed={p.isConfirmed} publicCardsSet={p.publicCardsSet} activeLane={p.activeLane}
            setActiveLane={p.setActiveLane} setShowPicker={p.setShowPicker}
            handleRemoveCard={p.handleRemoveCard} showToast={p.showToast}
            cardSize="large" avatarSize="w-10 h-10" textSize="text-sm"
          />
        </div>
      </div>

      {/* 底部操作 */}
      <BottomActionBar isConfirmed={p.isConfirmed} isSubmitting={p.isSubmitting} isSettling={p.isSettling}
        allSelectedCount={p.allSelectedCards.length} confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers}
        onRearrange={p.handleRearrange} onSubmit={p.handleSubmitHand} />

      {/* 弹层 */}
      <GameModals game={p.game} showPicker={p.showPicker} showScoreBoard={p.showScoreBoard}
        showInvite={p.showInvite} inviteCopied={p.inviteCopied} showGhostPicker={p.showGhostPicker}
        showCompare={p.showCompare} publicCards={p.publicCards} ghostCount={p.ghostCount}
        roundResult={p.roundResult} activeLane={p.activeLane} allSelectedCards={p.allSelectedCards}
        myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
        players={p.players} playerTotals={p.playerTotals} finishedRounds={p.finishedRounds}
        isHost={p.isHost} userId={p.userId}
        setShowPicker={p.setShowPicker} setShowInvite={p.setShowInvite} setInviteCopied={p.setInviteCopied}
        setShowScoreBoard={p.setShowScoreBoard} setShowGhostPicker={p.setShowGhostPicker}
        setActiveLane={p.setActiveLane} handleSelectCard={p.handleSelectCard}
        handleRemoveCard={p.handleRemoveCard} handleSetPublicCards={p.handleSetPublicCards}
        handleCompareClose={p.handleCompareClose} handleCloseRoom={p.handleCloseRoom}
        toast={p.toast} />
    </div>
  );
};
