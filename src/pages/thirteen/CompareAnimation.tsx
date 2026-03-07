import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { toPng } from 'html-to-image';
import { Player } from '../../lib/api';
import Avatar from '../../components/Avatar';
import { evaluateLaneName } from '../../lib/handEval';
import { RoundResult, SPECIAL_HAND_NAMES } from './types';
import { PokerCard, CardBack } from './PokerCard';

// ─── 逐对逐道比牌动画 ──────────────────────────────────────

// ─── 常量 ─────────────────────────────────────────────────────
const LANE_NAMES: Array<'head' | 'mid' | 'tail'> = ['head', 'mid', 'tail'];
const LANE_LABELS: Record<string, string> = { head: '头道', mid: '中道', tail: '尾道' };
const PARTICLE_BASE_STYLES = Array.from({ length: 12 }, (_, i) => ({
  left: '50%' as const, top: '50%' as const,
  animationDelay: `${i * 80}ms`,
  transform: `rotate(${i * 30}deg) translateY(-40px)`,
  opacity: 0 as const,
}));
const HOMERUN_PARTICLE_STYLES = PARTICLE_BASE_STYLES.map(s => ({ ...s, background: '#fbbf24' }));
const GUN_PARTICLE_STYLES = PARTICLE_BASE_STYLES.map(s => ({ ...s, background: '#f97316' }));

export const CompareAnimation = memo<{
  result: RoundResult; players: Player[]; userId?: string; onClose: () => void; replay?: boolean; gameName?: string;
}>(function CompareAnimation({ result, players, userId, onClose, replay = false, gameName }) {
  const { settlement, hands, publicCards, ghostCount, ghostMultiplier, roundNumber } = result;

  const playerMap = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of players) map[p.user_id] = p;
    return map;
  }, [players]);

  // 构建两两对战列表
  const pairs = useMemo(() => {
    const allPlayerIds = settlement.players.map(p => p.userId);
    const result: Array<[string, string]> = [];
    for (let i = 0; i < allPlayerIds.length; i++) {
      for (let j = i + 1; j < allPlayerIds.length; j++) {
        result.push([allPlayerIds[i], allPlayerIds[j]]);
      }
    }
    return result;
  }, [settlement.players]);

  // 构建每对每道的得分查找表: key = "userId_opponentId_lane" → score
  const pairLaneScores = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const sp of settlement.players) {
      for (const ls of sp.laneScores) {
        if (ls.lane === 'head' || ls.lane === 'mid' || ls.lane === 'tail') {
          const key = `${ls.userId}_${ls.opponentId}_${ls.lane}`;
          scores[key] = (scores[key] || 0) + ls.score;
        }
      }
    }
    return scores;
  }, [settlement.players]);

  // 检测每对是否打枪
  const pairGunStatus = useMemo(() => {
    const status: Record<string, { gunner: string | null }> = {};
    for (const [a, b] of pairs) {
      const key = `${a}_${b}`;
      let aWins = 0, bWins = 0;
      for (const lane of LANE_NAMES) {
        const scoreA = pairLaneScores[`${a}_${b}_${lane}`] || 0;
        if (scoreA > 0) aWins++;
        else if (scoreA < 0) bWins++;
      }
      status[key] = { gunner: aWins === 3 ? a : bWins === 3 ? b : null };
    }
    return status;
  }, [pairs, pairLaneScores]);

  // 阶段: 每对为一个阶段（一次性展开3道），最后一个阶段为汇总
  const summaryPhase = pairs.length;

  const [phase, setPhase] = useState(replay ? summaryPhase : -1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEffect, setShowEffect] = useState(false);

  // 分享截图
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 检测打枪/全垒打
  const hasHomerun = settlement.players.some(p => p.homerun);
  const hasGun = settlement.players.some(p => p.gunsFired > 0);
  const effectType = hasHomerun ? 'homerun' : hasGun ? 'gun' : null;

  useEffect(() => {
    if (replay) return;
    timerRef.current = setTimeout(() => setPhase(0), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [replay]);

  useEffect(() => {
    if (replay) return;
    if (phase < 0 || phase >= summaryPhase) return;
    timerRef.current = setTimeout(() => setPhase(phase + 1), 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, replay, summaryPhase]);

  // 进入结算阶段时触发特效
  useEffect(() => {
    if (phase === summaryPhase && effectType && !replay) {
      setShowEffect(true);
      const t = setTimeout(() => setShowEffect(false), 2500);
      return () => clearTimeout(t);
    }
  }, [phase, effectType, replay, summaryPhase]);

  const sorted = useMemo(() => [...settlement.players].sort((a, b) => b.finalScore - a.finalScore), [settlement.players]);

  const skipToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase(summaryPhase);
  };

  const getName = (uid: string) => playerMap[uid]?.users?.username || '?';
  const isMe = (uid: string) => uid === userId;

  const handleCapture = useCallback(async () => {
    if (!contentRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await toPng(contentRef.current, { pixelRatio: 3, backgroundColor: '#0a0a0a' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `十三水_第${roundNumber}局${gameName ? '_' + gameName : ''}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ title: `第${roundNumber}局对比`, files: [file] }); setIsCapturing(false); return; } catch { /* cancelled */ }
      }
      const a = document.createElement('a');
      a.href = dataUrl; a.download = fileName; a.click();
    } catch (err) { console.error('截图失败:', err); }
    setIsCapturing(false);
  }, [isCapturing, roundNumber, gameName]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col overflow-hidden" onClick={!replay && phase < summaryPhase ? skipToEnd : undefined}>
      <div className="flex-1 flex flex-col overflow-y-auto" ref={contentRef}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 'calc(48px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">第 {roundNumber} 局</span>
            {ghostCount > 0 && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg font-bold">
                鬼x{ghostCount} {ghostMultiplier}倍
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(phase >= summaryPhase || replay) && (
              <button onClick={(e) => { e.stopPropagation(); handleCapture(); }} className="p-1.5 rounded-lg hover:bg-white/10" title="分享">
                {isCapturing
                  ? <span className="material-symbols-outlined text-white animate-spin text-[20px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-white text-[20px]">share</span>}
              </button>
            )}
            {(phase >= summaryPhase || replay) && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 px-3 pt-2 pb-4 space-y-3">
          {/* 公共牌 */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            <span className="text-[11px] text-slate-500 font-medium">公共牌</span>
            {publicCards.length > 0 ? (
              <div className="flex gap-1">
                {publicCards.map((card, i) => (
                  <PokerCard key={i} card={card} faceUp small />
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-600">无</span>
            )}
            {ghostCount > 0 && (
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-bold ml-1">
                {ghostMultiplier}倍
              </span>
            )}
          </div>
          {/* 逐对比牌 — 每对一次性展开3道 */}
          {pairs.map(([pA, pB], pairIdx) => {
            const pairVisible = phase >= pairIdx || replay;
            if (!pairVisible) return null;

            const isCurrentPair = phase === pairIdx;
            const handA = hands.find(h => h.user_id === pA);
            const handB = hands.find(h => h.user_id === pB);
            const nameA = getName(pA);
            const nameB = getName(pB);
            const pairKey = `${pA}_${pB}`;
            const gun = pairGunStatus[pairKey];

            // 该对的三道总得分（A视角）
            let pairTotalA = 0;
            for (const lane of LANE_NAMES) {
              pairTotalA += pairLaneScores[`${pA}_${pB}_${lane}`] || 0;
            }

            return (
              <div key={pairKey} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${isCurrentPair ? 'border-primary/30 bg-primary/[0.03]' : 'border-white/10 bg-white/[0.02]'}`}>
                {/* 对战标题 */}
                <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isMe(pA) ? 'text-primary' : 'text-white'}`}>{nameA}</span>
                    <span className="text-[10px] text-slate-500">VS</span>
                    <span className={`text-xs font-bold ${isMe(pB) ? 'text-primary' : 'text-white'}`}>{nameB}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {gun?.gunner && <span className="text-[10px] text-orange-400 font-bold">{getName(gun.gunner)} 打枪!</span>}
                    <span className={`text-xs font-black ${pairTotalA > 0 ? 'text-emerald-400' : pairTotalA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      {pairTotalA > 0 ? `+${pairTotalA}` : pairTotalA} : {-pairTotalA > 0 ? `+${-pairTotalA}` : -pairTotalA}
                    </span>
                  </div>
                </div>
                {/* 三道一次性展开 */}
                <div className="p-2 space-y-1.5">
                  {LANE_NAMES.map((lane) => {
                    const cardCount = lane === 'head' ? 3 : 5;
                    const cardsA = handA ? (lane === 'head' ? handA.head_cards : lane === 'mid' ? handA.mid_cards : handA.tail_cards) : null;
                    const cardsB = handB ? (lane === 'head' ? handB.head_cards : lane === 'mid' ? handB.mid_cards : handB.tail_cards) : null;
                    const scoreA = pairLaneScores[`${pA}_${pB}_${lane}`] || 0;

                    const handNameA = cardsA ? evaluateLaneName(cardsA, lane) : null;
                    const handNameB = cardsB ? evaluateLaneName(cardsB, lane) : null;

                    return (
                      <div key={lane} className="rounded-xl p-2 bg-white/[0.01]">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] font-bold text-slate-500">{LANE_LABELS[lane]}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold w-10 truncate ${isMe(pA) ? 'text-primary' : 'text-slate-400'}`}>{nameA}</span>
                            <div className="flex gap-0.5 flex-1">
                              {cardsA ? cardsA.map((c, i) => <PokerCard key={i} card={c} faceUp small />) : Array(cardCount).fill(null).map((_, i) => <CardBack key={i} small />)}
                            </div>
                            {handNameA && <span className={`text-[10px] font-bold ${handNameA === '含鬼' ? 'text-purple-400' : 'text-cyan-400'}`}>{handNameA}</span>}
                            <div className="w-10 text-right">
                              <span className={`text-xs font-black ${scoreA > 0 ? 'text-emerald-400' : scoreA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                {scoreA > 0 ? `+${scoreA}` : scoreA}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold w-10 truncate ${isMe(pB) ? 'text-primary' : 'text-slate-400'}`}>{nameB}</span>
                            <div className="flex gap-0.5 flex-1">
                              {cardsB ? cardsB.map((c, i) => <PokerCard key={i} card={c} faceUp small />) : Array(cardCount).fill(null).map((_, i) => <CardBack key={i} small />)}
                            </div>
                            {handNameB && <span className={`text-[10px] font-bold ${handNameB === '含鬼' ? 'text-purple-400' : 'text-cyan-400'}`}>{handNameB}</span>}
                            <div className="w-10 text-right">
                              <span className={`text-xs font-black ${-scoreA > 0 ? 'text-emerald-400' : -scoreA < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                {-scoreA > 0 ? `+${-scoreA}` : -scoreA}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 最终汇总 */}
          {(phase >= summaryPhase || replay) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 animate-[fadeIn_0.5s_ease-out]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-400">最终结算</span>
                {ghostMultiplier > 1 && <span className="text-[10px] text-purple-400">鬼牌 {ghostMultiplier}x</span>}
              </div>
              {sorted.map((sp, idx) => {
                const name = getName(sp.userId);
                const hand = hands.find(h => h.user_id === sp.userId);
                return (
                  <div key={sp.userId} className={`flex items-center gap-3 p-3 rounded-xl border ${isMe(sp.userId) ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.03] border-white/5'}`}>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${idx === 0 && sp.finalScore > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-500'}`}>{idx + 1}</span>
                    <Avatar username={name} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white truncate block">{name}{isMe(sp.userId) ? ' (我)' : ''}</span>
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
      {(phase >= summaryPhase || replay) && (
        <div className="p-4 shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-base shadow-lg shadow-primary/30 transition-all active:scale-[0.98]">
            继续
          </button>
        </div>
      )}
      {/* 打枪/全垒打全屏特效 */}
      {showEffect && effectType && (
        <div className="fixed inset-0 z-[70] pointer-events-auto flex items-center justify-center animate-[effectIn_0.3s_ease-out]"
          onClick={() => setShowEffect(false)}>
          <div className={`absolute inset-0 ${effectType === 'homerun'
            ? 'bg-gradient-radial from-yellow-500/30 via-amber-600/10 to-transparent'
            : 'bg-gradient-radial from-orange-500/25 via-red-600/10 to-transparent'} animate-pulse`} />
          {(effectType === 'homerun' ? HOMERUN_PARTICLE_STYLES : GUN_PARTICLE_STYLES).map((style, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full animate-[particle_1.5s_ease-out_forwards]"
              style={style} />
          ))}
          <div className="relative flex flex-col items-center gap-3 animate-[effectBounce_0.6s_cubic-bezier(0.34,1.56,0.64,1)]">
            <span className="text-6xl">
              {effectType === 'homerun' ? '💥' : '🔫'}
            </span>
            <div className={`text-4xl font-black tracking-wider ${effectType === 'homerun'
              ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]'
              : 'text-orange-400 drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]'}`}>
              {effectType === 'homerun' ? '全垒打!' : '打枪!'}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {settlement.players.filter(p => effectType === 'homerun' ? p.homerun : p.gunsFired > 0).map(p => (
                <span key={p.userId} className="text-sm font-bold text-white/80 bg-white/10 px-3 py-1 rounded-full">
                  {getName(p.userId)}
                  {effectType === 'gun' && p.gunsFired > 1 ? ` x${p.gunsFired}` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
