import { supabase } from './supabase.js';

/**
 * 自动结算并关闭超过 24 小时的活跃房间
 * #11 优化：批量查询所有过期游戏的玩家和买入记录，避免 N+1 查询
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

        const gameIds = expiredGames.map(g => g.id);

        // 批量获取所有过期游戏的玩家
        const { data: allPlayers } = await supabase
            .from('game_players')
            .select('user_id, game_id')
            .in('game_id', gameIds);

        // 批量获取所有过期游戏的买入记录
        const { data: allBuyIns } = await supabase
            .from('buy_ins')
            .select('user_id, game_id, amount, type')
            .in('game_id', gameIds);

        // 按游戏分组
        const playersByGame: Record<string, string[]> = {};
        (allPlayers || []).forEach(p => {
            if (!playersByGame[p.game_id]) playersByGame[p.game_id] = [];
            playersByGame[p.game_id].push(p.user_id);
        });

        interface BuyInItem { user_id: string; game_id: string; amount: number; type: string }
        const buyInsByGame: Record<string, BuyInItem[]> = {};
        (allBuyIns || []).forEach((b: BuyInItem) => {
            if (!buyInsByGame[b.game_id]) buyInsByGame[b.game_id] = [];
            buyInsByGame[b.game_id].push(b);
        });

        // 收集所有结算记录，最后批量写入
        const allSettlements: Array<{
            game_id: string;
            user_id: string;
            final_chips: number;
            total_buyin: number;
            net_profit: number;
        }> = [];

        const gamesToClose: string[] = [];

        for (const game of expiredGames) {
            const gameId = game.id;
            const players = playersByGame[gameId] || [];
            const buyIns = buyInsByGame[gameId] || [];

            const playerStats: Record<string, { totalBuyin: number; finalChips: number }> = {};

            players.forEach(userId => {
                playerStats[userId] = { totalBuyin: 0, finalChips: 0 };
            });

            // 统计总买入和已有的结账记录
            const checkoutUsers = new Set<string>();
            buyIns.forEach(b => {
                if (!playerStats[b.user_id]) return;
                if (b.type === 'initial' || b.type === 'rebuy' || b.type === 'withdraw') {
                    playerStats[b.user_id].totalBuyin += b.amount;
                } else if (b.type === 'checkout') {
                    playerStats[b.user_id].finalChips = b.amount;
                    checkoutUsers.add(b.user_id);
                }
            });

            const settlementsForGame = Object.keys(playerStats).map(userId => {
                const stat = playerStats[userId];
                // 没提交过结账的人，系统强行按盈亏 = 0 结算
                const finalChips = checkoutUsers.has(userId) ? stat.finalChips : stat.totalBuyin;

                return {
                    game_id: gameId,
                    user_id: userId,
                    final_chips: finalChips,
                    total_buyin: stat.totalBuyin,
                    net_profit: finalChips - stat.totalBuyin,
                };
            });

            allSettlements.push(...settlementsForGame);
            gamesToClose.push(gameId);
        }

        // 批量写入结算记录
        if (allSettlements.length > 0) {
            const { error: insertError } = await supabase
                .from('settlements')
                .upsert(allSettlements, { onConflict: 'game_id,user_id' });

            if (insertError) {
                console.error('[cron] 批量自动结算写入记录失败:', insertError);
                return;
            }
        }

        // 批量更新游戏状态为 finished
        if (gamesToClose.length > 0) {
            const { error: updateError } = await supabase
                .from('games')
                .update({ status: 'finished', finished_at: new Date().toISOString() })
                .in('id', gamesToClose);

            if (updateError) {
                console.error('[cron] 批量关闭游戏失败:', updateError);
            } else {
                console.log(`[cron] 已自动关闭 ${gamesToClose.length} 个过期房间`);
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
