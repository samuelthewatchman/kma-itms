// Writes a notification row for one or more users. The bell in main.js picks
// these up instantly via Supabase Realtime — no polling needed.
import { supabase } from '../supabaseClient.js';

export async function notifyUsers(userIds, message, link = null) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  const rows = ids.map((user_id) => ({ user_id, message, link }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('notify failed:', error.message);
}
