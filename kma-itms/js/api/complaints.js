// All complaint/task logic that used to live in server/src/routes/complaints.js,
// re-expressed as direct Supabase calls. Row Level Security (schema.sql) is what
// actually stops a staff member reading someone else's complaint — this file just
// shapes the queries and, since there's no server anymore, does the notifying itself.
import { supabase } from '../supabaseClient.js';
import { getUser, isAdmin } from '../auth.js';
import { notifyUsers } from './notify.js';
import { logAudit } from './audit.js';
import { listAdminIds } from './users.js';

export const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// RLS already limits staff to their own rows, so this select needs no manual filter for that.
export async function listComplaints(status) {
  let q = supabase
    .from('complaints')
    .select('id,title,priority,status,created_at,profile:user_id(full_name,staff_id,department:department_id(name))')
    .order('created_at', { ascending: false })
    .limit(500);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createComplaint({ title, description, priority }) {
  title = (title || '').trim();
  description = (description || '').trim();
  if (!title || !description) throw new Error('Title and description are required');
  if (!PRIORITIES.includes(priority)) priority = 'medium';

  const { data: c, error } = await supabase
    .from('complaints')
    .insert({ user_id: getUser().id, title, description, priority })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await notifyUsers(await listAdminIds(), `New ${priority} complaint from ${getUser().full_name}: ${title}`, `/complaints/${c.id}`);
  await logAudit('create', 'complaint', c.id, { priority });
  return c;
}

export async function getComplaintDetail(id) {
  const { data: complaint, error } = await supabase
    .from('complaints')
    .select('*, profile:user_id(full_name,staff_id,email,department:department_id(name))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.code === 'PGRST116' ? 'Complaint not found' : error.message);

  const { data: messages } = await supabase
    .from('complaint_messages')
    .select('id,body,created_at,sender_id,sender:sender_id(full_name,role)')
    .eq('complaint_id', id)
    .order('created_at');

  let task = null;
  if (isAdmin()) {
    const { data } = await supabase
      .from('tasks')
      .select('id,status,due_date,assignee:assigned_to(full_name)')
      .eq('complaint_id', id)
      .order('id')
      .limit(1);
    task = (data || [])[0] || null;
  }
  return { complaint, messages: messages || [], task };
}

export async function sendMessage(complaint, body) {
  body = (body || '').trim();
  if (!body) throw new Error('Message cannot be empty');
  if (complaint.status === 'closed') throw new Error('This complaint is closed');

  const { error } = await supabase
    .from('complaint_messages')
    .insert({ complaint_id: complaint.id, sender_id: getUser().id, body });
  if (error) throw new Error(error.message);

  await supabase.from('complaints').update({ updated_at: new Date().toISOString() }).eq('id', complaint.id);

  if (isAdmin()) {
    await notifyUsers([complaint.user_id], `IT replied to your complaint: ${complaint.title}`, `/complaints/${complaint.id}`);
  } else {
    await notifyUsers(await listAdminIds(), `${getUser().full_name} replied on: ${complaint.title}`, `/complaints/${complaint.id}`);
  }
}

// IT Admin changes status. Setting "in_progress" auto-creates a linked task in Pending work
// (once — if one already exists for this complaint, it's left alone).
export async function updateStatus(complaint, { status, assigned_to, due_date }) {
  if (!STATUSES.includes(status)) throw new Error('Invalid status');
  const done = status === 'resolved' || status === 'closed';

  const { error } = await supabase
    .from('complaints')
    .update({ status, updated_at: new Date().toISOString(), resolved_at: done ? new Date().toISOString() : null })
    .eq('id', complaint.id);
  if (error) throw new Error(error.message);

  let taskCreated = false;
  if (status === 'in_progress') {
    const { data: existing } = await supabase.from('tasks').select('id').eq('complaint_id', complaint.id).limit(1);
    if (!existing || !existing.length) {
      const assignee = assigned_to || getUser().id;
      const fallbackDue = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const { error: tErr } = await supabase.from('tasks').insert({
        title: `Complaint #${complaint.id}: ${complaint.title}`,
        description: complaint.description,
        complaint_id: complaint.id,
        assigned_to: assignee,
        priority: complaint.priority,
        status: 'in_progress',
        due_date: due_date || fallbackDue,
        created_by: getUser().id,
      });
      if (tErr) throw new Error(tErr.message);
      taskCreated = true;
      if (assignee !== getUser().id) await notifyUsers([assignee], `New task assigned: ${complaint.title}`, '/pending-work');
    }
  }
  if (done) {
    await supabase.from('tasks').update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('complaint_id', complaint.id).neq('status', 'resolved');
  }

  await notifyUsers([complaint.user_id], `Your complaint "${complaint.title}" is now ${status.replace('_', ' ')}`, `/complaints/${complaint.id}`);
  await logAudit('status_change', 'complaint', complaint.id, { from: complaint.status, to: status, taskCreated });
  return { taskCreated };
}
