-- 原子自增 lucky_hands 表的 hit_count，避免竞态条件
-- 在 Supabase SQL Editor 中运行此脚本
CREATE OR REPLACE FUNCTION increment_hit_count(hand_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE lucky_hands
    SET hit_count = hit_count + 1
    WHERE id = hand_id
    RETURNING hit_count INTO new_count;

    IF new_count IS NULL THEN
        RAISE EXCEPTION 'Lucky hand not found: %', hand_id;
    END IF;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql;
