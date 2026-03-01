-- 1. games 表增加 lucky_hands_count (0-3)
ALTER TABLE games ADD COLUMN IF NOT EXISTS lucky_hands_count INTEGER NOT NULL DEFAULT 0 CHECK (lucky_hands_count >= 0 AND lucky_hands_count <= 3);

-- 2. 玩家的手牌配置表
CREATE TABLE IF NOT EXISTS lucky_hands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hand_index  INTEGER NOT NULL CHECK (hand_index IN (1, 2, 3)), -- 槽位 1, 2, 3
  card_1      TEXT NOT NULL, -- 例如 As, Kh
  card_2      TEXT NOT NULL,
  hit_count   INTEGER NOT NULL DEFAULT 0, -- 中奖次数
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id, hand_index)
);

-- 3. 玩家中奖待审核表
CREATE TABLE IF NOT EXISTS pending_lucky_hits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lucky_hand_id  UUID NOT NULL REFERENCES lucky_hands(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 建立索引
CREATE INDEX IF NOT EXISTS idx_lucky_hands_game_user ON lucky_hands(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pending_lucky_hits_game ON pending_lucky_hits(game_id);

-- 5. RLS 权限全开
ALTER TABLE lucky_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_lucky_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON lucky_hands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pending_lucky_hits FOR ALL USING (true) WITH CHECK (true);

-- 6. 开启实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE lucky_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_lucky_hits;
