-- ============================================
-- 13水功能迁移脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. games 表新增列
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'texas';
ALTER TABLE games ADD COLUMN IF NOT EXISTS thirteen_base_score INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN IF NOT EXISTS thirteen_ghost_count INTEGER NOT NULL DEFAULT 6;
ALTER TABLE games ADD COLUMN IF NOT EXISTS thirteen_compare_suit BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS thirteen_max_players INTEGER NOT NULL DEFAULT 4;
ALTER TABLE games ADD COLUMN IF NOT EXISTS thirteen_time_limit INTEGER NOT NULL DEFAULT 90;

-- room_type 约束（如果已有则先删再加）
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_room_type_check;
ALTER TABLE games ADD CONSTRAINT games_room_type_check CHECK (room_type IN ('texas', 'thirteen'));

-- 2. shame_timers 的 type 约束加入 'flower'
ALTER TABLE shame_timers DROP CONSTRAINT IF EXISTS shame_timers_type_check;
ALTER TABLE shame_timers ADD CONSTRAINT shame_timers_type_check CHECK (type IN ('timer', 'egg', 'chicken', 'flower'));

-- 3. 创建 thirteen_rounds 表
CREATE TABLE IF NOT EXISTS thirteen_rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'arranging' CHECK (status IN ('arranging', 'revealing', 'settled', 'finished')),
  public_cards JSONB NOT NULL DEFAULT '[]',
  ghost_count  INTEGER NOT NULL DEFAULT 0,
  ghost_multiplier INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(game_id, round_number)
);

-- 4. 创建 thirteen_hands 表
CREATE TABLE IF NOT EXISTS thirteen_hands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  head_cards  JSONB,
  mid_cards   JSONB,
  tail_cards  JSONB,
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  is_foul     BOOLEAN NOT NULL DEFAULT FALSE,
  special_hand TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- 5. 创建 thirteen_scores 表
CREATE TABLE IF NOT EXISTS thirteen_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lane        TEXT NOT NULL CHECK (lane IN ('head', 'mid', 'tail', 'special', 'gun', 'homerun', 'ghost')),
  score       INTEGER NOT NULL DEFAULT 0,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 创建 thirteen_totals 表
CREATE TABLE IF NOT EXISTS thirteen_totals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_score   INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER NOT NULL DEFAULT 0,
  guns_fired  INTEGER NOT NULL DEFAULT 0,
  homerun     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- 7. 索引
CREATE INDEX IF NOT EXISTS idx_thirteen_rounds_game ON thirteen_rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_hands_round ON thirteen_hands(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_hands_user  ON thirteen_hands(user_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_scores_round ON thirteen_scores(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_totals_round ON thirteen_totals(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_totals_user  ON thirteen_totals(user_id);

-- 8. RLS (开放策略，适合原型阶段)
ALTER TABLE thirteen_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_hands  ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_totals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thirteen_rounds' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON thirteen_rounds FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thirteen_hands' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON thirteen_hands FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thirteen_scores' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON thirteen_scores FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'thirteen_totals' AND policyname = 'Allow all for anon') THEN
    CREATE POLICY "Allow all for anon" ON thirteen_totals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- 9. 实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_totals;
