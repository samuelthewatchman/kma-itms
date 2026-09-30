// Records who did what, for the Super Admin's Audit log page.
import { supabase } from '../supabaseClient.js';
import { getUser } from '../auth.js';

export async function logAudit(action, entity, entityId, details = {}) {
  const { error } = await supabase
    .from('audit_log')
    .insert({ user_id: getUser().id, action, entity, entity_id: entityId, details });
  if (error) console.error('audit log failed:', error.message);
}
