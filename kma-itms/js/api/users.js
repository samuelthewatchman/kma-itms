import { supabase } from '../supabaseClient.js';
import { getUser } from '../auth.js';
import { logAudit } from './audit.js';

// IT Admins + Super Admins — the pool a complaint's task can be assigned to.
export async function listTechnicians() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['it_admin', 'super_admin'])
    .eq('is_active', true)
    .order('full_name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listAdminIds() {
  const { data, error } = await supabase.from('profiles').select('id').in('role', ['it_admin', 'super_admin']);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id);
}

/* ---------- Super Admin: Users page ---------- */

export async function listUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,staff_id,full_name,email,role,is_active,created_at,department:department_id(name)')
    .order('role')
    .order('full_name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listPendingInvites() {
  const { data, error } = await supabase
    .from('pending_admins')
    .select('email,staff_id,full_name,created_at,department:department_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Records an email as "destined to become IT Admin". The person still has to
// register themselves at /register — this just pre-authorizes the promotion.
export async function inviteAdmin({ staff_id, full_name, email, department_id }) {
  staff_id = (staff_id || '').trim();
  full_name = (full_name || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!staff_id || !full_name || !email) throw new Error('All fields are required');

  const { error } = await supabase.from('pending_admins').insert({
    email, staff_id, full_name, department_id: department_id || null, invited_by: getUser().id,
  });
  if (error) throw new Error(error.code === '23505' ? 'That email already has a pending invite' : error.message);
  await logAudit('invite_it_admin', 'pending_admin', null, { email });
}

export async function cancelInvite(email) {
  const { error } = await supabase.from('pending_admins').delete().eq('email', email);
  if (error) throw new Error(error.message);
  await logAudit('cancel_invite', 'pending_admin', null, { email });
}

export async function toggleActive(u) {
  if (u.id === getUser().id) throw new Error('You cannot change your own account here');
  if (u.role === 'super_admin') throw new Error('Super Admin accounts cannot be changed here');
  const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
  if (error) throw new Error(error.message);
  await logAudit('update', 'user', u.id, { is_active: !u.is_active });
}

export async function toggleRole(u) {
  if (u.id === getUser().id) throw new Error('You cannot change your own account here');
  if (u.role === 'super_admin') throw new Error('Super Admin accounts cannot be changed here');
  const role = u.role === 'staff' ? 'it_admin' : 'staff';
  const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id);
  if (error) throw new Error(error.message);
  await logAudit('update', 'user', u.id, { role });
}
