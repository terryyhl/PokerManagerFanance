import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in frontend env');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
