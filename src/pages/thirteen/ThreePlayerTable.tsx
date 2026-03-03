import React from 'react';
import {
  TableProps, OpponentArea, PublicCardsCenter, MyHandArea, BottomActionBar, SpectatorBar, GameModals,
} from './shared';

/** 3人桌布局 — 上对手 → 公共牌(中间) → 左右对手 → 自己 */
export const ThreePlayerTable: React.FC<TableProps> = (p) => {
  // 旁观者: 所有玩家都是"对手"，自己底部不显示摆牌区
  const allOpponents = p.isSpectator ? p.players : p.opponents;

  const getPos = (idx: number) => {
    if (allOpponents.length === 1) return 'top' as const;
    if (allOpponents.length === 2) {
      return idx === 0 ? 'left' as const : 'right' as const;
    }
    // 3个对手（旁观者模式下3人桌）
    if (idx === 0) return 'top' as const;
    if (idx === 1) return 'left' as const;
    return 'right' as const;
  };

  const topOpponents = allOpponents.filter((_, i) => getPos(i) === 'top');
  const leftOpponents = allOpponents.filter((_, i) => getPos(i) === 'left');
  const rightOpponents = allOpponents.filter((_, i) => getPos(i) === 'right');

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

      {/* 游戏主区域 — 四方位绝对定位 */}
      <div className="flex-1 flex flex-col relative min-h-0">
        <div className="flex-1 relative min-h-0">
          {/* 上方对手 */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2">
            {topOpponents.map(opp => (
              <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === p.game.created_by}
                confirmed={p.confirmedUsers.has(opp.user_id)} score={p.playerTotals[opp.user_id] || 0} />
            ))}
          </div>

          {/* 公共牌区域 — 上对手和左右对手之间 */}
          <div className="absolute top-[28%] left-1/2 -translate-x-1/2">
            <PublicCardsCenter
              publicCards={p.publicCards} publicCardsSet={p.publicCardsSet} ghostCount={p.ghostCount}
              isHost={p.isHost && !p.isSpectator} confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers}
              onEdit={() => p.setShowGhostPicker(true)} size="normal"
            />
          </div>

          {/* 左侧对手 */}
          <div className="absolute left-0 top-[55%] -translate-y-1/2">
            {leftOpponents.map(opp => (
              <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === p.game.created_by}
                confirmed={p.confirmedUsers.has(opp.user_id)} score={p.playerTotals[opp.user_id] || 0} />
            ))}
          </div>

          {/* 右侧对手 */}
          <div className="absolute right-0 top-[55%] -translate-y-1/2">
            {rightOpponents.map(opp => (
              <OpponentArea key={opp.id} player={opp} isPlayerHost={opp.user_id === p.game.created_by}
                confirmed={p.confirmedUsers.has(opp.user_id)} score={p.playerTotals[opp.user_id] || 0} />
            ))}
          </div>

          {/* 自己区域 — 居下中（旁观者不显示） */}
          {!p.isSpectator && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pb-1">
              <MyHandArea me={p.me} isHost={p.isHost} gameCreatedBy={p.game.created_by}
                playerTotals={p.playerTotals} myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
                isConfirmed={p.isConfirmed} publicCardsSet={p.publicCardsSet} activeLane={p.activeLane}
                setActiveLane={p.setActiveLane} setShowPicker={p.setShowPicker}
                handleRemoveCard={p.handleRemoveCard} showToast={p.showToast}
                cardSize="small"
              />
            </div>
          )}
        </div>
      </div>

      {/* 底部操作 */}
      {p.isSpectator ? (
        <SpectatorBar confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers} />
      ) : (
        <BottomActionBar isConfirmed={p.isConfirmed} isSubmitting={p.isSubmitting} isSettling={p.isSettling}
          allSelectedCount={p.allSelectedCards.length} confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers}
          onRearrange={p.handleRearrange} onSubmit={p.handleSubmitHand} />
      )}

      {/* 弹层 */}
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
        toast={p.toast} />
    </div>
  );
};
