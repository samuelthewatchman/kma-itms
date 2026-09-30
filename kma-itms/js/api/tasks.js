// Supabase equivalent of server/src/routes/tasks.js. This whole module is only
// ever called from an IT Admin / Super Admin session — the router restricts the
// Pending work page to 'admin' access, and RLS backs that up at the database level.
import { supabase } from '../supabaseClient.js';
import { getUser } from '../auth.js';
import { notifyUsers } from './notify.js';
import { logAudit } from './audit.js';

export const STATUSES = ['open', 'in_progress', 'resolved'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export async function listTasks({ status, mine } = {}) {
  let q = supabase
    .from('tasks')
    .select('id,title,description,priority,status,due_date,complaint_id,asset_id,assigned_to,assignee:assigned_to(full_name),complaint:complaint_id(title),asset:asset_id(asset_tag)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (STATUSES.includes(status)) q = q.eq('status', status);
  if (mine) q = q.eq('assigned_to', getUser().id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // resolved tasks last, same as the old SQL's ORDER BY (status='resolved')
  const rows = data || [];
  rows.sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved'));
  return rows;
}

export async function createTask({ title, description, priority = 'medium', assigned_to, due_date, asset_id }) {
  title = (title || '').trim();
  if (!title) throw new Error('Title is required');
  if (!PRIORITIES.includes(priority)) priority = 'medium';
  const assignee = assigned_to || getUser().id;

  const { data: t, error } = await supabase
    .from('tasks')
    .insert({
      title, description: description || null, priority,
      assigned_to: assignee, due_date: due_date || null, asset_id: asset_id || null,
      created_by: getUser().id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (assignee !== getUser().id) await notifyUsers([assignee], `New task assigned: ${t.title}`, '/pending-work');
  await logAudit('create', 'task', t.id);
  return t;
}

export async function patchTask(old, patch) {
  if (patch.status && !STATUSES.includes(patch.status)) throw new Error('Invalid status');
  if (patch.priority && !PRIORITIES.includes(patch.priority)) throw new Error('Invalid priority');

  const update = { ...patch };
  if (patch.status === 'resolved') update.resolved_at = new Date().toISOString();
  else if (patch.status) update.resolved_at = null;

  const { data: t, error } = await supabase.from('tasks').update(update).eq('id', old.id).select().single();
  if (error) throw new Error(error.message);

  if (patch.assigned_to && patch.assigned_to !== old.assigned_to && patch.assigned_to !== getUser().id) {
    await notifyUsers([patch.assigned_to], `Task assigned to you: ${t.title}`, '/pending-work');
  }

  if (patch.status === 'resolved' && t.complaint_id) {
    const { data: c } = await supabase
      .from('complaints')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', t.complaint_id)
      .in('status', ['open', 'in_progress'])
      .select('user_id,title')
      .maybeSingle();
    // resolved_at should only be set if it wasn't already
    await supabase.from('complaints').update({ resolved_at: new Date().toISOString() }).eq('id', t.complaint_id).is('resolved_at', null);
    if (c) await notifyUsers([c.user_id], `Your complaint "${c.title}" is now resolved`, `/complaints/${t.complaint_id}`);
  }

  await logAudit('update', 'task', t.id, { status: t.status });
  return t;
}
