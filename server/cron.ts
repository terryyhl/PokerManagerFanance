import { supabase } from './supabase.js';
import { broadcastToGame } from './sse.js';

/**
 * 自动结算并关闭超过 24 小时的活跃房间
 */
export async function autoCloseExpiredGames() {
    try {
        // 计算 24 小时前的时间点
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        // 查找创建时间超过 24 小时且仍在 active 状态的游戏
        const { data: expiredGames, error: gamesError } = await supabase
            .from('games')
            .select('id, name')
            .eq('status', 'active')
            .lt('created_at', yesterday.toISOString());

        if (gamesError) {
            console.error('[cron] 获取过期游戏失败:', gamesError);
            return;
        }

        if (!expiredGames || expiredGames.length === 0) {
            return;
        }

        console.log(`[cron] 发现 ${expiredGames.length} 个超过 24 小时未结束的房间，开始自动结算`);

        for (const game of expiredGames) {
            const gameId = game.id;

            // 获取该游戏的所有玩家
            const { data: players } = await supabase
                .from('game_players')
                .select('user_id')
                .eq('game_id', gameId);

            // 获取所有买入记录
            const { data: buyIns } = await supabase
                .from('buy_ins')
                .select('*')
                .eq('game_id', gameId);

            const playerStats: Record<string, { totalBuyin: number; finalChips: number }> = {};

            (players || []).forEach(p => {
                playerStats[p.user_id] = { totalBuyin: 0, finalChips: 0 };
            });

            // 统计总买入和已有的结账记录
            (buyIns || []).forEach(b => {
                if (!playerStats[b.user_id]) return;
                if (b.type === 'initial' || b.type === 'rebuy') {
                    playerStats[b.user_id].totalBuyin += b.amount;
                } else if (b.type === 'checkout') {
                    // 如果用户自己登记了结账，就用它的最终筹码
                    playerStats[b.user_id].finalChips = b.amount;
                }
            });

            // 对于没有结账记录的玩家，自动将其 finalChips 设为 0 (自动结算视为清零，也可以根据需要设为 totalBuyin 视作保本。这里采取保本策略避免非预期的系统级输钱：即没有登记筹码，算作没输没赢)
            // 修改：打牌通常如果人跑了没结账，按理是输光。但这里是记账工具，建议默认 `finalChips = totalBuyin` 强行平账，或者如果是真实比赛则是 0。
            // 为了安全稳妥且防扯皮，系统自动结算时，如果用户完全没有 checkout 记录，将 final_chips 设置为当时的总买入 (盈亏 0)。
            // 如果用户有 checkout 记录，那么上面已经赋值了 finalChips。
            const hasCheckoutRecord = (userId: string) => (buyIns || []).some(b => b.user_id === userId && b.type === 'checkout');

            const settlementsToInsert = Object.keys(playerStats).map(userId => {
                const stat = playerStats[userId];
                let finalChips = stat.finalChips;

                if (!hasCheckoutRecord(userId)) {
                    // 没提交过结账的人，系统强行按盈亏 = 0 结算（最终筹码=总买入）
                    finalChips = stat.totalBuyin;
                }

                return {
                    game_id: gameId,
                    user_id: userId,
                    final_chips: finalChips,
                    total_buyin: stat.totalBuyin,
                    net_profit: finalChips - stat.totalBuyin,
                };
            });

            if (settlementsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('settlements')
                    .upsert(settlementsToInsert, { onConflict: 'game_id,user_id' });

                if (insertError) {
                    console.error(`[cron] 自动结算游戏 ${gameId} 写入记录失败:`, insertError);
                    continue; // 写入失败就不关房间
                }
            }

            // 更新游戏状态为 finished
            const { error: updateError } = await supabase
                .from('games')
                .update({ status: 'finished', finished_at: new Date().toISOString() })
                .eq('id', gameId);

            if (!updateError) {
                console.log(`[cron] 已自动关闭过期房间: ${game.name} (${gameId})`);
                // 广播通知可能还挂在房间里的端口
                broadcastToGame(gameId, 'game_settled', { message: '房间超过 24 小时，已由系统自动结算并关闭' });
            }
        }
    } catch (err) {
        console.error('[cron] auto close target error:', err);
    }
}

/**
 * 启动定时任务，每隔 15 分钟检查一次
 */
export function startCronJobs() {
    // 启动时立刻执行一次
    autoCloseExpiredGames();

    // 15 分钟执行一次 (15 * 60 * 1000 = 900000 ms)
    setInterval(autoCloseExpiredGames, 900000);
    console.log('[cron] 自动结算定时任务已启动');
}
