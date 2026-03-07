-- 玩家自报座位号
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS seat_number INTEGER;

-- buy_ins.type 增加 seat_report 类型（用于时间线展示座位消息）
ALTER TABLE buy_ins DROP CONSTRAINT IF EXISTS buy_ins_type_check;
ALTER TABLE buy_ins ADD CONSTRAINT buy_ins_type_check CHECK (type IN ('initial', 'rebuy', 'checkout', 'seat_report'));
