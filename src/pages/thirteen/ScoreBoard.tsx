import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { toPng } from 'html-to-image';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Player } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { RoundResult, SettlementPlayer, HandState } from './types';
import { CompareAnimation } from './CompareAnimation';

// ─── 积分账单面板 ────────────────────────────────────────────

export const ScoreBoard = memo<{
  gameId: string; gameName: string; players: Player[]; playerTotals: Record<string, number>;
  finishedRounds: number; isHost: boolean; userId?: string;
  onClose: () => void; onCloseRoom: () => void;
}>(function ScoreBoard({ gameId, gameName, players, playerTotals, finishedRounds, isHost, userId, onClose, onCloseRoom }) {
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
        publicCards: data.round.public_cards || [],
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

  const sorted = useMemo(() => players
    .map(p => ({ ...p, total: playerTotals[p.user_id] || 0 }))
    .sort((a, b) => b.total - a.total), [players, playerTotals]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="bg-background-dark flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 border-b border-white/5 shrink-0" style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
          {/* 累计得分折线图 */}
          {(() => {
            const finishedHistory = history.filter((r: any) => r.status === 'finished');
            if (finishedHistory.length < 2) return null;
            // 按 round_number 排序
            const sortedRounds = [...finishedHistory].sort((a: any, b: any) => a.round_number - b.round_number);
            // 收集所有玩家ID和名称
            const playerNames: Record<string, string> = {};
            for (const p of players) playerNames[p.user_id] = p.users?.username || '?';
            // 构建累计分数数据
            const cumScores: Record<string, number> = {};
            const chartData = sortedRounds.map((round: any) => {
              const point: Record<string, any> = { round: `第${round.round_number}局` };
              for (const t of (round.totals || [])) {
                cumScores[t.user_id] = (cumScores[t.user_id] || 0) + t.final_score;
                point[t.user_id] = cumScores[t.user_id];
              }
              return point;
            });
            // 玩家颜色
            const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
            const playerIds = Object.keys(playerNames);
            return (
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-sm font-bold text-slate-400 mb-2">得分走势</h3>
                <div className="bg-surface-dark rounded-xl border border-white/5 p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <XAxis dataKey="round" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ background: '#1a2632', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}
                        itemStyle={{ padding: '1px 0' }}
                      />
                      {playerIds.map((uid, i) => (
                        <Line key={uid} type="monotone" dataKey={uid} name={playerNames[uid]}
                          stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {playerIds.map((uid, i) => (
                      <div key={uid} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] text-slate-400">{playerNames[uid]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">第 {round.round_number} 局</span>
                        {round.ghost_count > 0 && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">鬼x{round.ghost_count} ({round.ghost_multiplier}倍)</span>}
                      </div>
                      <div className="flex items-center gap-1">
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
          <div className="p-4 border-t border-white/5 shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
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
});
