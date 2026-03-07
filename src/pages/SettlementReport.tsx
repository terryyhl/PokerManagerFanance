import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import anime from 'animejs';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AnimatedPage from '../components/AnimatedPage';
import { settlementApi, PlayerStat, Game } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';
import SettlementSharePoster from '../components/SettlementSharePoster';

interface BuyInEvent {
  userId: string;
  amount: number;
  type: string;
  createdAt: string;
}

export default function SettlementReport() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const contentRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const [game, setGame] = useState<Game | null>(null);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localChips, setLocalChips] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 汇率：每积分对应的真实货币金额（例如 1积分 = $0.1）
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [rateInput, setRateInput] = useState<string>('1');
  // 分享海报
  const [showSharePoster, setShowSharePoster] = useState(false);
  // 买入历史
  const [buyInHistory, setBuyInHistory] = useState<BuyInEvent[]>([]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const res = await settlementApi.get(id);
      setGame(res.game);
      setStats(res.stats);
      setIsFinished(res.hasSettlement || res.game.status === 'finished');
      const chips: Record<string, number> = {};
      res.stats.forEach(s => { chips[s.userId] = s.finalChips; });
      setLocalChips(chips);
      setBuyInHistory((res as any).buyInHistory || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (!isLoading && !hasAnimated.current) {
      hasAnimated.current = true;
      if (!contentRef.current) return;
      anime({
        targets: contentRef.current.children,
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutExpo',
        delay: anime.stagger(100)
      });
    }
  }, [isLoading]);

  const handleChipChange = (userId: string, value: string) => {
    setLocalChips(prev => ({ ...prev, [userId]: parseInt(value, 10) || 0 }));
    setErrorMsg(null);
  };

  const handleRateChange = (val: string) => {
    setRateInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) setExchangeRate(parsed);
  };

  const handleFinalize = async () => {
    if (!id) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const playerResults = stats.map(s => ({
        userId: s.userId,
        finalChips: localChips[s.userId] ?? s.finalChips,
      }));
      await settlementApi.submit(id, user!.id, playerResults);
      await fetchData();
      setIsFinished(true);
    } catch (err: any) {
      setErrorMsg(err.message || '结算提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBuyIn = stats.reduce((sum, s) => sum + s.totalBuyin, 0);
  const totalChips = stats.reduce((sum, s) => sum + (localChips[s.userId] ?? s.finalChips), 0);
  const totalProfit = totalChips - totalBuyIn;
  const isBalanced = Math.abs(totalChips - totalBuyIn) <= 1;

  // 水上（正盈亏总和）/ 水下（负盈亏总和）
  const { totalUp, totalDown } = stats.reduce((acc, s) => {
    const chips = localChips[s.userId] ?? s.finalChips;
    const profit = chips - s.totalBuyin;
    if (profit > 0) acc.totalUp += profit;
    else if (profit < 0) acc.totalDown += profit;
    return acc;
  }, { totalUp: 0, totalDown: 0 });

  // 格式化真实金额
  const toReal = (chips: number) => (chips * exchangeRate).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage animationType="slide-up">
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-full h-full">
        <div className="relative flex min-h-full h-full w-full flex-col mx-auto bg-background-light dark:bg-background-dark">
          <div className="sticky top-0 z-20 flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => navigate(-1)}
              className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight flex-1 text-center">结算报告</h2>
            <button
              onClick={() => setShowSharePoster(true)}
              className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="分享"
            >
              <span className="material-symbols-outlined text-[22px]">share</span>
            </button>
          </div>

          {isFinished && (
            <div className="bg-green-500 text-white px-4 py-3 flex items-center justify-between text-sm font-medium">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>结算已完成并存档</span>
              </div>
            </div>
          )}

          <div ref={contentRef} className="flex-1 overflow-y-auto pb-24">
            {/* 最终筹码统计 */}
            <div className="px-4 py-6 opacity-0">
              <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight pb-2">最终筹码统计</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal pb-6">
                {isFinished ? '本局游戏已锁定，无法修改筹码数据。' : '输入每位玩家剩余的筹码数以计算最终结算。'}
              </p>

              {stats.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-3">casino</span>
                  <p className="text-slate-500 text-sm">暂无玩家数据</p>
                </div>
              ) : (
                <div className={`bg-white dark:bg-[#1a2632] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${isFinished ? 'opacity-90' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">玩家列表</h3>
                    {/* 平账状态 */}
                    {!isFinished && (
                      <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${isBalanced ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
                        <span className="material-symbols-outlined text-[12px]">{isBalanced ? 'check_circle' : 'error'}</span>
                        {isBalanced ? '已平账' : `差 ${totalChips - totalBuyIn} 积分`}
                      </span>
                    )}
                  </div>

                  {stats.map(s => (
                    <div key={s.userId} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0 last:pb-0">
                      <div className="size-8 rounded-full overflow-hidden">
                        <Avatar username={s.username} />
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-900 dark:text-white text-sm font-medium">
                          {s.username}
                          {s.userId === user?.id && <span className="ml-1 text-xs text-primary font-normal">(你)</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">买入: {s.totalBuyin} 积分</p>
                      </div>
                      <input
                        className={`w-24 rounded-lg border border-slate-200 dark:border-slate-700 h-9 px-3 text-right text-sm ${isFinished || (game?.created_by !== user?.id && s.userId !== user?.id)
                          ? 'bg-slate-200/50 dark:bg-[#111a22]/50 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-[#111a22] text-slate-900 dark:text-white focus:border-primary focus:ring-primary'
                          }`}
                        disabled={isFinished || (game?.created_by !== user?.id && s.userId !== user?.id)}
                        placeholder="0"
                        type="number"
                        value={localChips[s.userId] ?? s.finalChips}
                        onChange={(e) => handleChipChange(s.userId, e.target.value)}
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-2 bg-slate-100 dark:bg-[#0b1218] opacity-0"></div>

            {/* 成员买入走势折线图 */}
            {buyInHistory.length >= 2 && (() => {
              // 按时间排序
              const sorted = [...buyInHistory].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              // 收集玩家名称映射
              const nameMap: Record<string, string> = {};
              stats.forEach(s => { nameMap[s.userId] = s.username; });
              const playerIds = [...new Set(sorted.map(e => e.userId))];
              // 构建累计买入数据点：每次买入事件作为一个数据点
              const cumBuyIn: Record<string, number> = {};
              const chartData: Record<string, any>[] = [];
              // 添加起点（全部0）
              const startPoint: Record<string, any> = { label: '开始' };
              playerIds.forEach(uid => { startPoint[uid] = 0; cumBuyIn[uid] = 0; });
              chartData.push(startPoint);
              // 逐条累加
              sorted.forEach((e, i) => {
                cumBuyIn[e.userId] = (cumBuyIn[e.userId] || 0) + e.amount;
                const point: Record<string, any> = {
                  label: `#${i + 1}`,
                };
                playerIds.forEach(uid => { point[uid] = cumBuyIn[uid] || 0; });
                chartData.push(point);
              });
              const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
              return (
                <div className="px-4 py-4 opacity-0">
                  <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">买入走势</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#1a2632', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                          labelStyle={{ color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}
                          itemStyle={{ padding: '1px 0' }}
                        />
                        {playerIds.map((uid, i) => (
                          <Line key={uid} type="monotone" dataKey={uid} name={nameMap[uid] || '?'}
                            stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {playerIds.map((uid, i) => (
                        <div key={uid} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{nameMap[uid] || '?'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 汇率设置 */}
            <div className="px-4 py-4 opacity-0">
              <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[22px]">currency_exchange</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">汇率设置</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">每积分换算成多少真实货币</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500">1 积分 =</span>
                  <input
                    type="number"
                    min="0.001"
                    step="0.01"
                    value={rateInput}
                    onChange={e => handleRateChange(e.target.value)}
                    onClick={e => (e.target as HTMLInputElement).select()}
                    disabled={isFinished}
                    className={`w-20 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-right px-2 focus:border-primary focus:outline-none ${isFinished
                        ? 'bg-slate-200/50 dark:bg-[#111a22]/50 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        : 'bg-slate-50 dark:bg-[#111a22] text-slate-900 dark:text-white'
                      }`}
                    placeholder="1.00"
                  />
                  <span className="text-xs text-slate-500">$</span>
                </div>
              </div>
            </div>

            {/* 对局总结 */}
            <div className="px-4 py-4 opacity-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-900 dark:text-white text-lg font-bold">{game?.name || '对局总结'}</h2>
                {isFinished ? (
                  <span className="text-xs font-medium px-2 py-1 bg-slate-500/10 text-slate-500 dark:text-slate-400 rounded border border-slate-500/20">已结束</span>
                ) : (
                  <span className="text-xs font-medium px-2 py-1 bg-green-500/10 text-green-500 rounded border border-green-500/20">进行中</span>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2632]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-[#15202b] text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">玩家</th>
                      <th className="px-4 py-3 font-semibold text-right">净盈亏</th>
                      <th className="px-4 py-3 font-semibold text-right">实际金额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {stats.map(s => {
                      const chips = localChips[s.userId] ?? s.finalChips;
                      const profit = chips - s.totalBuyin;
                      const isMe = s.userId === user?.id;
                      return (
                        <tr key={s.userId} className={isMe ? 'bg-primary/5' : ''}>
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium">
                            {s.username}{isMe && <span className="ml-1 text-xs text-primary">(你)</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold text-sm ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {profit > 0 ? '+' : ''}{profit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {profit >= 0 ? '+' : ''}${toReal(profit)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-[#15202b] border-t border-slate-200 dark:border-slate-700">
                    <tr className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-4 py-2.5 font-semibold text-sm text-green-600 dark:text-green-400">水上</td>
                      <td className="px-4 py-2.5 text-right font-bold text-sm text-green-600 dark:text-green-400">
                        +{totalUp}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-sm text-green-600 dark:text-green-400">
                        +${toReal(totalUp)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-4 py-2.5 font-semibold text-sm text-red-500 dark:text-red-400">水下</td>
                      <td className="px-4 py-2.5 text-right font-bold text-sm text-red-500 dark:text-red-400">
                        {totalDown}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-sm text-red-500 dark:text-red-400">
                        -${toReal(Math.abs(totalDown))}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">总池</td>
                      <td className={`px-4 py-3 text-right font-bold ${totalProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {totalProfit > 0 ? '+' : ''}{totalProfit}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${totalProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {totalProfit >= 0 ? '+' : ''}${toReal(totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {!isFinished ? (
                  game?.created_by === user?.id ? (
                    <button
                      onClick={handleFinalize}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-base font-bold text-slate-900 dark:text-white transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      ) : '完成结算并关闭房间'}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-2">
                      <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                      <span>等待房主核对并完成结算</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-sm py-2">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    <span>结算已于 {game?.finished_at ? new Date(game.finished_at).toLocaleString('zh-CN') : '--'} 完成</span>
                  </div>
                )}
                <button
                  onClick={() => navigate('/lobby', { replace: true })}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-white transition-colors hover:bg-blue-600 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">home</span>
                  返回大厅
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 分享海报 */}
        {game && (
          <SettlementSharePoster
            isOpen={showSharePoster}
            onClose={() => setShowSharePoster(false)}
            game={game}
            stats={stats}
            localChips={localChips}
            exchangeRate={exchangeRate}
            currentUserId={user?.id}
          />
        )}
      </div>
    </AnimatedPage>
  );
}
