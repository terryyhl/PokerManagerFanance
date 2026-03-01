-- 增加类型字段，用来区分 pending_lucky_hits 表里的数据是"中奖审核"(hit)还是"改牌审核"(update)
ALTER TABLE pending_lucky_hits 
ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) DEFAULT 'hit';

-- 为"改牌审核"存储玩家新选择的两张牌
ALTER TABLE pending_lucky_hits 
ADD COLUMN IF NOT EXISTS new_card_1 VARCHAR(10);

ALTER TABLE pending_lucky_hits 
ADD COLUMN IF NOT EXISTS new_card_2 VARCHAR(10);
