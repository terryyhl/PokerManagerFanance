import React from 'react';
import {
  TableProps, OpponentArea, PublicCardsThumbnail, MyHandArea, BottomActionBar, GameModals,
} from './shared';

/** 4人桌布局 — 公共牌在标题栏，四方位绝对定位，紧凑模式 */
export const FourPlayerTable: React.FC<TableProps> = (p) => {
  // 4人桌: 3个对手固定分配到 上/左/右
  const topOpp = p.opponents[0];
  const leftOpp = p.opponents[1];
  const rightOpp = p.opponents[2];

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col overflow-hidden relative">
      {/* 标题栏: 返回 + 公共牌缩略 + 按钮 */}
      <div className="flex items-center justify-between px-2 h-[58px] bg-black/30 border-b border-white/5 shrink-0">
        <button onClick={() => p.setGamePhase('waiting')} className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
          <PublicCardsThumbnail publicCards={p.publicCards} ghostCount={p.ghostCount}
            isHost={p.isHost} onEdit={() => p.setShowGhostPicker(true)} />
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

      {/* 游戏主区域 — 四方位绝对定位 */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* 上方对手 — 居上中 */}
        {topOpp && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <OpponentArea player={topOpp} isPlayerHost={topOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(topOpp.user_id)} score={p.playerTotals[topOpp.user_id] || 0} compact />
          </div>
        )}

        {/* 左侧对手 — 居左中，留 padding 防溢出 */}
        {leftOpp && (
          <div className="absolute left-1 top-[45%] -translate-y-1/2">
            <OpponentArea player={leftOpp} isPlayerHost={leftOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(leftOpp.user_id)} score={p.playerTotals[leftOpp.user_id] || 0} compact />
          </div>
        )}

        {/* 右侧对手 — 居右中，留 padding 防溢出 */}
        {rightOpp && (
          <div className="absolute right-1 top-[45%] -translate-y-1/2">
            <OpponentArea player={rightOpp} isPlayerHost={rightOpp.user_id === p.game.created_by}
              confirmed={p.confirmedUsers.has(rightOpp.user_id)} score={p.playerTotals[rightOpp.user_id] || 0} compact />
          </div>
        )}

        {/* 中间状态信息 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>{p.confirmedUsers.size}/{p.currentPlayers} 已确认</span>
          </div>
        </div>

        {/* 自己区域 — 居下中 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pb-1">
          <MyHandArea me={p.me} isHost={p.isHost} gameCreatedBy={p.game.created_by}
            playerTotals={p.playerTotals} myHeadCards={p.myHeadCards} myMidCards={p.myMidCards} myTailCards={p.myTailCards}
            isConfirmed={p.isConfirmed} publicCardsSet={p.publicCardsSet} activeLane={p.activeLane}
            setActiveLane={p.setActiveLane} setShowPicker={p.setShowPicker}
            handleRemoveCard={p.handleRemoveCard} showToast={p.showToast}
            cardSize="small"
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
