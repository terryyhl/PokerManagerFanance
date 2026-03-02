-- ============================================
-- 扑克财务管理器 - Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 启用 uuid 生成扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 游戏/房间表
-- ============================================
CREATE TABLE IF NOT EXISTS games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  blind_level     TEXT NOT NULL DEFAULT '1/2',
  min_buyin       INTEGER NOT NULL DEFAULT 100,
  max_buyin       INTEGER NOT NULL DEFAULT 400,
  insurance_mode  BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_hands_count INTEGER NOT NULL DEFAULT 0 CHECK (lucky_hands_count >= 0 AND lucky_hands_count <= 3),
  room_code       TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

-- ============================================
-- 游戏玩家关联表
-- ============================================
CREATE TABLE IF NOT EXISTS game_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- ============================================
-- 买入记录表
-- ============================================
CREATE TABLE IF NOT EXISTS buy_ins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount >= 0),
  type        TEXT NOT NULL DEFAULT 'initial' CHECK (type IN ('initial', 'rebuy', 'checkout')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 结算记录表
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_buyin   INTEGER NOT NULL DEFAULT 0,
  final_chips   INTEGER NOT NULL DEFAULT 0,
  net_profit    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- ============================================
-- 幸运手牌配置表
-- ============================================
CREATE TABLE IF NOT EXISTS lucky_hands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hand_index  INTEGER NOT NULL CHECK (hand_index IN (1, 2, 3)),
  card_1      TEXT NOT NULL,
  card_2      TEXT NOT NULL,
  hit_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id, hand_index)
);

-- ============================================
-- 幸运手牌中奖待审核表
-- ============================================
CREATE TABLE IF NOT EXISTS pending_lucky_hits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lucky_hand_id  UUID NOT NULL REFERENCES lucky_hands(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 思考计时记录表（趣味互动：催促对手出牌）
-- ============================================
CREATE TABLE IF NOT EXISTS shame_timers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  target_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'timer' CHECK (type IN ('timer', 'egg', 'chicken')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 索引优化
-- ============================================
CREATE INDEX IF NOT EXISTS idx_games_status        ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_room_code     ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_game_players_game   ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user   ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_buy_ins_game        ON buy_ins(game_id);
CREATE INDEX IF NOT EXISTS idx_buy_ins_user        ON buy_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_game    ON settlements(game_id);
CREATE INDEX IF NOT EXISTS idx_shame_timers_game   ON shame_timers(game_id);
CREATE INDEX IF NOT EXISTS idx_shame_timers_target ON shame_timers(target_user_id);

-- ============================================
-- Row Level Security (RLS) - 基础配置
-- 目前设为公开可读写（无认证），适合原型阶段
-- ============================================
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE games        ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_ins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements  ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（使用 anon key 的客户端可以读写所有数据）
CREATE POLICY "Allow all for anon" ON users        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON games        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON game_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON buy_ins      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON settlements  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON lucky_hands  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pending_lucky_hits FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE shame_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON shame_timers FOR ALL USING (true) WITH CHECK (true);

-- 开启实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE lucky_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_lucky_hits;
