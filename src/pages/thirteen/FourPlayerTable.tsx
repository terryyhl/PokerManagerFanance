import React from 'react';
import {
  TableProps, OpponentArea, PublicCardsThumbnail, MyHandArea, BottomActionBar, SpectatorBar, GameModals,
} from './shared';

/** 4人桌布局 — 公共牌在标题栏，四方位绝对定位 */
export const FourPlayerTable: React.FC<TableProps> = (p) => {
  // 旁观者: 所有玩家都是"对手"，全部显示在四方位
  const allOpponents = p.isSpectator ? p.players : p.opponents;

  // 4人桌: 固定分配到 上/左/右/下
  const topOpp = allOpponents[0];
  const leftOpp = allOpponents[1];
  const rightOpp = allOpponents[2];
  const bottomOpp = p.isSpectator ? allOpponents[3] : undefined;

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col overflow-hidden relative">
      {/* 标题栏: 返回 + 公共牌缩略 + 按钮 */}
      <div className="flex items-center justify-between px-2 h-[58px] bg-black/30 border-b border-white/5 shrink-0">
        <button onClick={() => p.setGamePhase('waiting')} className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
          <PublicCardsThumbnail publicCards={p.publicCards} ghostCount={p.ghostCount}
            isHost={p.isHost && !p.isSpectator} onEdit={() => p.setShowGhostPicker(true)} />
          {p.isSpectator && <span className="text-[10px] text-slate-400 bg-white/10 px-1.5 py-0.5 rounded font-bold ml-1">旁观</span>}
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
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* 上方对手 — 居上中 */}
        {topOpp && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <OpponentArea player={topOpp} isPlayerHost={topOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(topOpp.user_id)} score={p.playerTotals[topOpp.user_id] || 0} />
          </div>
        )}

        {/* 左侧对手 — 居左中 */}
        {leftOpp && (
          <div className="absolute left-1 top-[45%] -translate-y-1/2">
            <OpponentArea player={leftOpp} isPlayerHost={leftOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(leftOpp.user_id)} score={p.playerTotals[leftOpp.user_id] || 0} />
          </div>
        )}

        {/* 右侧对手 — 居右中 */}
        {rightOpp && (
          <div className="absolute right-1 top-[45%] -translate-y-1/2">
            <OpponentArea player={rightOpp} isPlayerHost={rightOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(rightOpp.user_id)} score={p.playerTotals[rightOpp.user_id] || 0} />
          </div>
        )}

        {/* 中间状态信息 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>{p.confirmedUsers.size}/{p.currentPlayers} 已确认</span>
          </div>
        </div>

        {/* 自己区域 — 居下中；旁观者显示第4个对手 */}
        {p.isSpectator ? (
          bottomOpp && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pb-1">
              <OpponentArea player={bottomOpp} isPlayerHost={bottomOpp.user_id === p.game.created_by}
                confirmed={p.confirmedUsers.has(bottomOpp.user_id)} score={p.playerTotals[bottomOpp.user_id] || 0} />
            </div>
          )
        ) : (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pb-1">
            <MyHandArea me={p.me} isHost={p.isHost} gameCreatedBy={p.game.created_by}
              playerTotals={p.playerTotals} myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
              isConfirmed={p.isConfirmed} publicCardsSet={p.publicCardsSet} activeLane={p.activeLane}
              setActiveLane={p.setActiveLane} setShowPicker={p.setShowPicker}
              handleRemoveCard={p.handleRemoveCard} handleCardTap={p.handleCardTap} selectedCard={p.selectedCard}
              showToast={p.showToast} cardSize="small"
            />
          </div>
        )}
      </div>

      {/* 底部操作 */}
      {p.isSpectator ? (
        <SpectatorBar confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers} />
      ) : (
        <BottomActionBar isConfirmed={p.isConfirmed} isSubmitting={p.isSubmitting} isSettling={p.isSettling}
          allSelectedCount={p.allSelectedCards.length} confirmedCount={p.confirmedUsers.size} totalPlayers={p.currentPlayers}
          onRearrange={p.handleRearrange} onAutoArrange={p.handleAutoArrange} isAutoArranging={p.isAutoArranging}
          onSubmit={p.handleSubmitHand} onForceSettle={p.handleForceSettle} />
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
        handleCloseRoomConfirm={p.handleCloseRoomConfirm} showCloseConfirm={p.showCloseConfirm} setShowCloseConfirm={p.setShowCloseConfirm}
        toast={p.toast} />
    </div>
  );
};
