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
  room_type       TEXT NOT NULL DEFAULT 'texas' CHECK (room_type IN ('texas', 'thirteen')),
  blind_level     TEXT NOT NULL DEFAULT '1/2',
  min_buyin       INTEGER NOT NULL DEFAULT 100,
  max_buyin       INTEGER NOT NULL DEFAULT 400,
  insurance_mode  BOOLEAN NOT NULL DEFAULT FALSE,
  lucky_hands_count INTEGER NOT NULL DEFAULT 0 CHECK (lucky_hands_count >= 0 AND lucky_hands_count <= 3),
  points_per_hand INTEGER NOT NULL DEFAULT 100,              -- 每手积分额度（德州房间使用）
  max_hands_per_buy INTEGER NOT NULL DEFAULT 10,             -- 单次买入最大手数
  -- 13水专属配置
  thirteen_base_score  INTEGER NOT NULL DEFAULT 1,        -- 底分（所有得分乘以底分）
  thirteen_ghost_count INTEGER NOT NULL DEFAULT 6,        -- 鬼牌数量（0/2/4/6）
  thirteen_compare_suit BOOLEAN NOT NULL DEFAULT TRUE,    -- 是否比花色
  thirteen_max_players INTEGER NOT NULL DEFAULT 4,        -- 最大人数（2~4）
  thirteen_time_limit  INTEGER NOT NULL DEFAULT 90,       -- 摆牌倒计时（秒）
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
  nickname    TEXT,                                      -- 房间内昵称（可选，为空时显示 username）
  seat_number INTEGER,                                  -- 玩家座位号（NULL=未分配）
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
  type        TEXT NOT NULL DEFAULT 'initial' CHECK (type IN ('initial', 'rebuy', 'checkout', 'seat_report')),
  created_by  UUID REFERENCES users(id),              -- 操作人（NULL=本人，非NULL=代操作人）
  hand_count  INTEGER,                                -- 本次买入手数（兼容旧数据可为空）
  points_per_hand INTEGER,                            -- 当时的每手积分快照（兼容旧数据可为空）
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
-- 13水：对局轮次表
-- ============================================
CREATE TABLE IF NOT EXISTS thirteen_rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'arranging' CHECK (status IN ('arranging', 'revealing', 'settling', 'settled', 'finished')),
  public_cards JSONB NOT NULL DEFAULT '[]',   -- 6张公共牌 ["AS", "KH", "JK1", ...]
  ghost_count  INTEGER NOT NULL DEFAULT 0,     -- 公共牌中鬼牌数量
  ghost_multiplier INTEGER NOT NULL DEFAULT 1, -- 鬼牌倍率 2^n
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(game_id, round_number)
);

-- ============================================
-- 13水：玩家手牌与摆牌表
-- ============================================
CREATE TABLE IF NOT EXISTS thirteen_hands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  head_cards  JSONB,                             -- 头道3张（玩家手动选牌摆入）
  mid_cards   JSONB,                             -- 中道5张
  tail_cards  JSONB,                             -- 尾道5张
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,   -- 是否已确认摆牌
  is_foul     BOOLEAN NOT NULL DEFAULT FALSE,    -- 是否乌龙
  special_hand TEXT,                              -- 报到牌型: 'dragon'/'straight_dragon'/'six_pairs'/'three_flush'/'three_straight' / NULL
  confirmed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- ============================================
-- 13水：逐道比分记录表
-- ============================================
CREATE TABLE IF NOT EXISTS thirteen_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 得分者
  opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 对手
  lane        TEXT NOT NULL CHECK (lane IN ('head', 'mid', 'tail', 'special', 'gun', 'homerun', 'ghost')),
  score       INTEGER NOT NULL DEFAULT 0,       -- 正=赢，负=输
  detail      TEXT,                              -- 描述，如 "同花顺 5分"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 13水：每局每人总分汇总表
-- ============================================
CREATE TABLE IF NOT EXISTS thirteen_totals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES thirteen_rounds(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_score   INTEGER NOT NULL DEFAULT 0,        -- 原始分（三道 + 打枪 + 全垒打）
  final_score INTEGER NOT NULL DEFAULT 0,        -- 最终分（含鬼牌倍率和底分）
  guns_fired  INTEGER NOT NULL DEFAULT 0,        -- 打枪次数
  homerun     BOOLEAN NOT NULL DEFAULT FALSE,    -- 是否全垒打
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, user_id)
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
CREATE INDEX IF NOT EXISTS idx_thirteen_rounds_game ON thirteen_rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_hands_round ON thirteen_hands(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_hands_user  ON thirteen_hands(user_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_scores_round ON thirteen_scores(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_totals_round ON thirteen_totals(round_id);
CREATE INDEX IF NOT EXISTS idx_thirteen_totals_user  ON thirteen_totals(user_id);

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

ALTER TABLE thirteen_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_hands  ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE thirteen_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON thirteen_rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON thirteen_hands  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON thirteen_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON thirteen_totals FOR ALL USING (true) WITH CHECK (true);

-- 开启实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE lucky_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_lucky_hits;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE thirteen_totals;
