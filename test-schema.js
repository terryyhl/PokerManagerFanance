import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function get() {
  const { data: q1 } = await supabase.from('settlements').select('*').limit(1);
  console.log("Settlements schema:", Object.keys(q1[0] || {}).join(', '));
  const { data: q2 } = await supabase.from('games').select('*').limit(1);
  console.log("Games schema:", Object.keys(q2[0] || {}).join(', '));
}
get();
