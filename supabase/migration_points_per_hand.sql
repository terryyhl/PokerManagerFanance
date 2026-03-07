-- 每手积分额度：games 表新增配置字段
ALTER TABLE games ADD COLUMN IF NOT EXISTS points_per_hand INTEGER NOT NULL DEFAULT 100;
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_hands_per_buy INTEGER NOT NULL DEFAULT 10;

-- 买入记录：记录手数和当时的每手积分快照（兼容旧数据可为空）
ALTER TABLE buy_ins ADD COLUMN IF NOT EXISTS hand_count INTEGER;
ALTER TABLE buy_ins ADD COLUMN IF NOT EXISTS points_per_hand INTEGER;

-- 待审核买入：同样增加手数和每手积分字段
ALTER TABLE pending_buyins ADD COLUMN IF NOT EXISTS hand_count INTEGER;
ALTER TABLE pending_buyins ADD COLUMN IF NOT EXISTS points_per_hand INTEGER;
