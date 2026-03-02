import React, { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { PlayerStat, Game } from '../lib/api';

interface SettlementSharePosterProps {
    isOpen: boolean;
    onClose: () => void;
    game: Game;
    stats: PlayerStat[];
    localChips: Record<string, number>;
    exchangeRate: number;
    currentUserId?: string;
}

/** 结算报告分享海报 — 纯 DOM 渲染 → html-to-image 导出 */
export default function SettlementSharePoster({
    isOpen,
    onClose,
    game,
    stats,
    localChips,
    exchangeRate,
    currentUserId,
}: SettlementSharePosterProps) {
    const posterRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const toReal = (chips: number) =>
        (chips * exchangeRate).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 按净盈亏降序排列
    const sorted = [...stats].sort((a, b) => {
        const pa = (localChips[a.userId] ?? a.finalChips) - a.totalBuyin;
        const pb = (localChips[b.userId] ?? b.finalChips) - b.totalBuyin;
        return pb - pa;
    });

    const totalBuyIn = stats.reduce((sum, s) => sum + s.totalBuyin, 0);

    const generateImage = useCallback(async () => {
        if (!posterRef.current) return;
        setIsGenerating(true);
        try {
            const dataUrl = await toPng(posterRef.current, {
                pixelRatio: 3,
                backgroundColor: '#0f1923',
            });
            setPreviewUrl(dataUrl);
        } catch (err) {
            console.error('生成图片失败:', err);
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const handleShare = async () => {
        if (!previewUrl) return;

        // 将 dataUrl 转为 blob
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        const file = new File([blob], `结算报告_${game.name}.png`, { type: 'image/png' });

        // 尝试使用 Web Share API（移动端）
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    title: `${game.name} 结算报告`,
                    files: [file],
                });
                return;
            } catch {
                // 用户取消或不支持，继续到下载
            }
        }

        // 降级为下载
        const a = document.createElement('a');
        a.href = previewUrl;
        a.download = `结算报告_${game.name}.png`;
        a.click();
    };

    const handleSaveImage = async () => {
        if (!previewUrl) return;
        const a = document.createElement('a');
        a.href = previewUrl;
        a.download = `结算报告_${game.name}.png`;
        a.click();
    };

    if (!isOpen) return null;

    const finishedDate = game.finished_at
        ? new Date(game.finished_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '--';

    const content = (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4" onClick={e => e.stopPropagation()}>
                {/* 隐藏的海报 DOM — 用于截图，只在生成前显示 */}
                {!previewUrl && (
                    <div
                        ref={posterRef}
                        style={{
                            width: 375,
                            padding: '28px 20px',
                            background: 'linear-gradient(180deg, #0f1923 0%, #162230 50%, #0f1923 100%)',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            color: '#e2e8f0',
                        }}
                    >
                        {/* 头部 */}
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 16px',
                                background: 'rgba(59,130,246,0.15)',
                                borderRadius: 20,
                                border: '1px solid rgba(59,130,246,0.3)',
                                marginBottom: 12,
                            }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>
                                    {game.name}
                                </span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
                                结算报告
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                                盲注 {game.blind_level} · 总池 {totalBuyIn} 积分 · {finishedDate}
                            </div>
                        </div>

                        {/* 玩家排名列表 */}
                        <div style={{
                            background: 'rgba(26,38,50,0.8)',
                            borderRadius: 16,
                            border: '1px solid rgba(51,65,85,0.5)',
                            overflow: 'hidden',
                        }}>
                            {/* 表头 */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 16px',
                                fontSize: 10,
                                fontWeight: 600,
                                color: '#64748b',
                                textTransform: 'uppercase' as const,
                                borderBottom: '1px solid rgba(51,65,85,0.5)',
                                letterSpacing: 1,
                            }}>
                                <span style={{ width: 28 }}>#</span>
                                <span style={{ flex: 1 }}>玩家</span>
                                <span style={{ width: 80, textAlign: 'right' as const }}>净盈亏</span>
                                <span style={{ width: 80, textAlign: 'right' as const }}>实际金额</span>
                            </div>

                            {/* 行 */}
                            {sorted.map((s, idx) => {
                                const chips = localChips[s.userId] ?? s.finalChips;
                                const profit = chips - s.totalBuyin;
                                const isMe = s.userId === currentUserId;
                                const rank = idx + 1;
                                const profitColor = profit > 0 ? '#34d399' : profit < 0 ? '#f87171' : '#94a3b8';
                                const initial = s.username.charAt(0).toUpperCase();

                                // 排名颜色
                                const rankColors: Record<number, string> = { 1: '#fbbf24', 2: '#94a3b8', 3: '#d97706' };
                                const rankColor = rankColors[rank] || '#475569';

                                return (
                                    <div
                                        key={s.userId}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            borderBottom: idx < sorted.length - 1 ? '1px solid rgba(51,65,85,0.3)' : 'none',
                                            background: isMe ? 'rgba(59,130,246,0.08)' : 'transparent',
                                        }}
                                    >
                                        {/* 排名 */}
                                        <span style={{
                                            width: 28,
                                            fontSize: rank <= 3 ? 16 : 13,
                                            fontWeight: 800,
                                            color: rankColor,
                                        }}>
                                            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                                        </span>

                                        {/* 头像 + 名字 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                background: `linear-gradient(135deg, ${isMe ? '#3b82f6' : '#475569'}, ${isMe ? '#60a5fa' : '#64748b'})`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: '#fff',
                                                flexShrink: 0,
                                            }}>
                                                {initial}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: isMe ? '#60a5fa' : '#e2e8f0',
                                                    whiteSpace: 'nowrap' as const,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}>
                                                    {s.username}
                                                    {isMe && <span style={{ fontSize: 10, color: '#3b82f6', marginLeft: 4 }}>(我)</span>}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                                    买入 {s.totalBuyin}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 盈亏 */}
                                        <span style={{
                                            width: 80,
                                            textAlign: 'right' as const,
                                            fontSize: 14,
                                            fontWeight: 800,
                                            color: profitColor,
                                        }}>
                                            {profit > 0 ? '+' : ''}{profit}
                                        </span>

                                        {/* 实际金额 */}
                                        <span style={{
                                            width: 80,
                                            textAlign: 'right' as const,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: profitColor,
                                        }}>
                                            {profit >= 0 ? '+' : ''}¥{toReal(profit)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 汇率信息 */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            marginTop: 16,
                            padding: '8px 16px',
                            background: 'rgba(59,130,246,0.08)',
                            borderRadius: 10,
                            border: '1px solid rgba(59,130,246,0.2)',
                        }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>汇率</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
                                1 积分 = ¥{exchangeRate % 1 === 0 ? exchangeRate : exchangeRate.toFixed(2)}
                            </span>
                        </div>

                        {/* 底部水印 */}
                        <div style={{
                            textAlign: 'center' as const,
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: '1px solid rgba(51,65,85,0.3)',
                        }}>
                            <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>
                                Poker Finance Manager
                            </div>
                            <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                                {new Date().toLocaleDateString('zh-CN')} 生成
                            </div>
                        </div>
                    </div>
                )}

                {/* 预览已生成的图片 */}
                {previewUrl && (
                    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                        <img
                            src={previewUrl}
                            alt="结算报告"
                            className="w-full rounded-xl shadow-2xl border border-slate-700"
                        />
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex flex-col gap-3 w-full max-w-sm mt-6">
                    {!previewUrl ? (
                        <button
                            onClick={generateImage}
                            disabled={isGenerating}
                            className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                    生成中...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px]">image</span>
                                    生成分享图片
                                </>
                            )}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleShare}
                                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">share</span>
                                分享给好友
                            </button>
                            <button
                                onClick={handleSaveImage}
                                className="w-full py-3.5 rounded-xl bg-slate-700 text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">download</span>
                                保存到相册
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl text-slate-400 font-medium text-sm transition-colors hover:text-white"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
