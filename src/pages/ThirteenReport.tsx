import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import AnimatedPage from '../components/AnimatedPage';
import { gamesApi, Player } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';
import {
    SettlementPlayer, HandState, RoundResult, CompareAnimation, PokerCard,
} from './thirteen/shared';

export default function ThirteenReport() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useUser();

    const [gameName, setGameName] = useState('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [playerTotals, setPlayerTotals] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // 回放
    const [replayResult, setReplayResult] = useState<RoundResult | null>(null);
    const [loadingRoundId, setLoadingRoundId] = useState<string | null>(null);

    // 分享
    const [showSharePoster, setShowSharePoster] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const posterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setIsLoading(true);
            setError('');
            try {
                // 获取游戏基础信息
                const gameRes = await gamesApi.get(id);
                setGameName(gameRes.game.name);
                setPlayers(gameRes.players);

                // 获取轮次历史
                const histRes = await fetch(`/api/thirteen/${id}/history?_t=${Date.now()}`);
                const histData = await histRes.json();
                const rounds = histData.rounds || [];
                setHistory(rounds);

                // 计算累计总分
                const totals: Record<string, number> = {};
                for (const round of rounds) {
                    if (round.status !== 'finished') continue;
                    for (const t of (round.totals || [])) {
                        totals[t.user_id] = (totals[t.user_id] || 0) + (t.final_score || 0);
                    }
                }
                setPlayerTotals(totals);
            } catch (err: any) {
                setError(err.message || '加载失败');
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    const handleViewRound = async (roundId: string) => {
        if (!id || loadingRoundId) return;
        setLoadingRoundId(roundId);
        try {
            const res = await fetch(`/api/thirteen/${id}/round/${roundId}?_t=${Date.now()}`);
            const data = await res.json();
            if (!data.round) return;
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

    const finishedRounds = history.filter((r: any) => r.status === 'finished');
    const sorted = players
        .map(p => ({ ...p, total: playerTotals[p.user_id] || 0 }))
        .sort((a, b) => b.total - a.total);

    return (
        <AnimatedPage animationType="slide-left">
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-background-dark text-slate-100">

                {/* Header */}
                <div className="flex items-center gap-3 px-4 pb-3 border-b border-white/5 shrink-0" style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}>
                    <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/10">
                        <span className="material-symbols-outlined text-white text-xl">arrow_back</span>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">{gameName || '十三水'}</h2>
                        <p className="text-xs text-slate-400">{finishedRounds.length} 局已完成</p>
                    </div>
                    <button onClick={() => { setPreviewUrl(null); setShowSharePoster(true); }} className="p-1.5 rounded-lg hover:bg-white/10" title="分享">
                        <span className="material-symbols-outlined text-white">share</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <span className="material-symbols-outlined animate-spin text-3xl text-slate-600">progress_activity</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center py-20 text-center px-6">
                            <span className="material-symbols-outlined text-4xl text-slate-500 mb-3">error_outline</span>
                            <p className="text-slate-400 text-sm">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* 总分排名 */}
                            <div className="px-4 pt-4 pb-2">
                                <h3 className="text-sm font-bold text-slate-400 mb-3">总分排名</h3>
                                <div className="space-y-2">
                                    {sorted.map((p, idx) => {
                                        const name = p.users?.username || '?';
                                        const isMe = p.user_id === user?.id;
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

                            {/* 每局明细 */}
                            <div className="px-4 pt-4 pb-20">
                                <h3 className="text-sm font-bold text-slate-400 mb-3">每局明细</h3>
                                {finishedRounds.length === 0 ? (
                                    <p className="text-center text-slate-600 text-sm py-8">暂无已完成的牌局</p>
                                ) : (
                                    <div className="space-y-2">
                                        {finishedRounds.map((round: any) => (
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
                                                {(round.public_cards || []).length > 0 && (
                                                    <div className="flex items-center gap-1 mb-2">
                                                        <span className="text-[10px] text-slate-500">公共牌:</span>
                                                        <div className="flex gap-0.5">
                                                            {(round.public_cards as string[]).map((card: string, ci: number) => (
                                                                <PokerCard key={ci} card={card} faceUp small />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
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
                        </>
                    )}
                </div>

                {/* 回放弹层 */}
                {replayResult && (
                    <CompareAnimation
                        result={replayResult}
                        players={players}
                        userId={user?.id}
                        onClose={() => setReplayResult(null)}
                        replay
                        gameName={gameName}
                    />
                )}

                {/* 分享海报弹层 */}
                {showSharePoster && (
                    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-sm" onClick={() => setShowSharePoster(false)}>
                        <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4" onClick={e => e.stopPropagation()}>
                            {!previewUrl && (
                                <div ref={posterRef} style={{
                                    width: 375, padding: '28px 20px',
                                    background: 'linear-gradient(180deg, #0f1923 0%, #162230 50%, #0f1923 100%)',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    color: '#e2e8f0',
                                }}>
                                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{gameName}</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>十三水积分账单 · {finishedRounds.length} 局</div>
                                    </div>
                                    {sorted.map((p, idx) => {
                                        const name = p.users?.username || '?';
                                        return (
                                            <div key={p.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                                borderRadius: 12, marginBottom: 8,
                                                background: idx === 0 && p.total > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                                                border: idx === 0 && p.total > 0 ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.05)',
                                            }}>
                                                <span style={{
                                                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 12, fontWeight: 900,
                                                    background: idx === 0 && p.total > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                                                    color: idx === 0 && p.total > 0 ? '#fbbf24' : '#64748b',
                                                }}>{idx + 1}</span>
                                                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#fff' }}>{name}</span>
                                                <span style={{
                                                    fontSize: 18, fontWeight: 900,
                                                    color: p.total > 0 ? '#34d399' : p.total < 0 ? '#f87171' : '#fbbf24',
                                                }}>{p.total > 0 ? `+${p.total}` : p.total}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {previewUrl && (
                                <img src={previewUrl} alt="海报预览" className="w-full max-w-[375px] rounded-xl shadow-2xl" />
                            )}
                        </div>
                        <div className="shrink-0 p-4 flex gap-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
                            {!previewUrl ? (
                                <button onClick={generateImage} disabled={isGenerating}
                                    className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isGenerating ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <span className="material-symbols-outlined text-lg">image</span>}
                                    {isGenerating ? '生成中...' : '生成海报'}
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleShare}
                                        className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-lg">share</span>分享
                                    </button>
                                    <button onClick={() => setShowSharePoster(false)}
                                        className="py-3.5 px-6 rounded-2xl bg-white/10 text-white font-bold text-base">关闭</button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AnimatedPage>
    );
}
