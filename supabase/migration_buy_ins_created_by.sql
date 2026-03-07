-- 买入记录增加 created_by 字段，记录操作人（房主代操作时非空）
ALTER TABLE buy_ins ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
