import React from 'react';
import Avatar from '../../components/Avatar';
import {
  TableProps, PokerCard, CardBack, PublicCardsCenter, MyHandArea, BottomActionBar, SpectatorBar, GameModals,
  OpponentArea,
} from './shared';

/** 2人桌布局 — 上对手(放大) → 公共牌(中间放大) → 自己(放大) */
export const TwoPlayerTable: React.FC<TableProps> = (p) => {
  // 旁观者看到的对手 = 所有玩家；玩家看到的对手 = 除自己外
  const allOpponents = p.isSpectator ? p.players : p.opponents;
  const topOpponent = allOpponents[0];
  const bottomOpponent = p.isSpectator ? allOpponents[1] : undefined;

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col overflow-hidden relative">
      {/* 标题栏: 返回 + 房间名 + 按钮 */}
      <div className="flex items-center justify-between px-2 h-[58px] bg-black/30 border-b border-white/5 shrink-0">
        <button onClick={() => p.setGamePhase('waiting')} className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
          <span className="text-sm font-bold text-white truncate">{p.game.name}</span>
          {p.isSpectator && <span className="text-[10px] text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-bold">旁观</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => p.setShowInvite(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="邀请/密码">
            <span className="material-symbols-outlined text-[20px] text-slate-400">vpn_key</span>
          </button>
          <button onClick={() => p.setShowScoreBoard(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="积分账单">
            <span className="material-symbols-outlined text-[20px] text-slate-400">receipt_long</span>
          </button>
        </div>
      </div>

      {/* 游戏主区域 */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* 对手区域 */}
        {topOpponent && (() => {
          const oppName = topOpponent.users?.username || '?';
          const oppScore = p.playerTotals[topOpponent.user_id] || 0;
          const oppConfirmed = !!p.confirmedUsers[topOpponent.user_id];
          return (
            <div className="flex flex-col items-center pt-2 pb-1 shrink-0">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <Avatar username={oppName} isAdmin={topOpponent.user_id === p.game.created_by} className="w-8 h-8" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{oppName}</span>
                    <span className={`text-xs font-black ${oppScore > 0 ? 'text-emerald-400' : oppScore < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {oppScore > 0 ? `+${oppScore}` : oppScore}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 relative">
                  <div className="flex gap-0.5">{Array(3).fill(null).map((_, i) => <CardBack key={i} />)}</div>
                  <div className="flex gap-0.5">{Array(5).fill(null).map((_, i) => <CardBack key={i} />)}</div>
                  <div className="flex gap-0.5">{Array(5).fill(null).map((_, i) => <CardBack key={i} />)}</div>
                  {oppConfirmed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg backdrop-blur-[1px]">
                      <span className="text-2xl font-black text-blue-400 drop-shadow-lg">OK</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 公共牌区域 (中间) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <PublicCardsCenter
            publicCards={p.publicCards} publicCardsSet={p.publicCardsSet} ghostCount={p.ghostCount}
            isHost={p.isHost && !p.isSpectator} confirmedCount={Object.keys(p.confirmedUsers).length} totalPlayers={p.currentPlayers}
            onEdit={() => p.setShowGhostPicker(true)} size="normal"
          />
        </div>

        {/* 自己区域 — 旁观者显示第二个对手 */}
        {p.isSpectator ? (
          bottomOpponent && (
            <div className="flex flex-col items-center pb-1 pt-1 border-t border-white/5 shrink-0">
              <OpponentArea player={bottomOpponent} isPlayerHost={bottomOpponent.user_id === p.game.created_by}
                confirmed={!!p.confirmedUsers[bottomOpponent.user_id]} score={p.playerTotals[bottomOpponent.user_id] || 0} />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center pb-1 pt-1 border-t border-white/5 shrink-0">
            <MyHandArea me={p.me} isHost={p.isHost} gameCreatedBy={p.game.created_by}
              playerTotals={p.playerTotals} myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
              isConfirmed={p.isConfirmed} publicCardsSet={p.publicCardsSet} activeLane={p.activeLane}
              setActiveLane={p.setActiveLane} setShowPicker={p.setShowPicker}
              handleRemoveCard={p.handleRemoveCard} handleCardTap={p.handleCardTap} selectedCard={p.selectedCard}
              showToast={p.showToast}
            />
          </div>
        )}
      </div>

      {/* 底部操作 */}
      {p.isSpectator ? (
        <SpectatorBar confirmedCount={Object.keys(p.confirmedUsers).length} totalPlayers={p.currentPlayers} />
      ) : (
        <BottomActionBar isConfirmed={p.isConfirmed} isSubmitting={p.isSubmitting} isSettling={p.isSettling}
          allSelectedCount={p.allSelectedCards.length} confirmedCount={Object.keys(p.confirmedUsers).length} totalPlayers={p.currentPlayers}
          onRearrange={p.handleRearrange} onAutoArrange={p.handleAutoArrange} isAutoArranging={p.isAutoArranging}
          onSubmit={p.handleSubmitHand} onForceSettle={p.handleForceSettle} />
      )}

      {/* 弹层 — 旁观者不显示选牌器 */}
      <GameModals game={p.game} showPicker={p.isSpectator ? false : p.showPicker} showScoreBoard={p.showScoreBoard}
        showInvite={p.showInvite} inviteCopied={p.inviteCopied} showGhostPicker={p.isSpectator ? false : p.showGhostPicker}
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
        handleCloseRoomConfirm={p.handleCloseRoomConfirm} showCloseConfirm={p.showCloseConfirm} setShowCloseConfirm={p.setShowCloseConfirm}
        toast={p.toast} />
    </div>
  );
};
