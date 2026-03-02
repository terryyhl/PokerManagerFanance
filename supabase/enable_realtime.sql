-- 开启游戏相关表的数据变更实时广播
-- 注意：在 Supabase 中，只有加入到了 supabase_realtime publication 里的表才会把数据更改发送到 WebSocket
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE buy_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_buyins;
ALTER PUBLICATION supabase_realtime ADD TABLE shame_timers;
