import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] 缺少环境变量 SUPABASE_URL 或 SUPABASE_ANON_KEY');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
