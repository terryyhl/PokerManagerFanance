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
  type        TEXT NOT NULL CHECK (type IN ('initial', 'rebuy')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 开启 RLS
ALTER TABLE pending_buyins ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问
CREATE POLICY "Allow all for anon" ON pending_buyins FOR ALL USING (true) WITH CHECK (true);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_pending_buyins_game ON pending_buyins(game_id);
