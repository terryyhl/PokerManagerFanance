-- ============================================
-- 待审核买入申请表
-- 解决 Vercel Serverless 环境下内存存储失效的问题
-- ============================================

CREATE TABLE IF NOT EXISTS pending_buyins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  total_buyin INTEGER NOT NULL DEFAULT 0,
  type        TEXT NOT NULL CHECK (type IN ('initial', 'rebuy')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 如果表已存在但缺少 total_buyin 列，运行此语句补列：
-- ALTER TABLE pending_buyins ADD COLUMN IF NOT EXISTS total_buyin INTEGER NOT NULL DEFAULT 0;


-- 开启 RLS
ALTER TABLE pending_buyins ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问
CREATE POLICY "Allow all for anon" ON pending_buyins FOR ALL USING (true) WITH CHECK (true);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_pending_buyins_game ON pending_buyins(game_id);
