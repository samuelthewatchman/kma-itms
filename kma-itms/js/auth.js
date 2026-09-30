// Login state. Supabase Auth handles email + password; the `profiles` table holds
// the staff ID, name, department and ROLE for each account.
import { supabase } from './supabaseClient.js';

let currentUser = null; // the signed-in person's profile row (or null)

export const getUser = () => currentUser;
export const isAdmin = () => ['super_admin', 'it_admin'].includes(currentUser?.role);
export const isSuper = () => currentUser?.role === 'super_admin';

async function loadProfile(authId) {
  const { data } = await supabase
    .from('profiles')
    .select('*, department:department_id(name)')
    .eq('id', authId)
    .maybeSingle();
  return data;
}

// Called once when the page loads: is there already a saved session?
export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const profile = await loadProfile(data.session.user.id);
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return null;
  }
  return (currentUser = profile);
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const profile = await loadProfile(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('No staff profile found for this account.');
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated. Please contact IT.');
  }
  return (currentUser = profile);
}

export async function register({ staff_id, full_name, email, department_id, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');

  const { error: pErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    staff_id,
    full_name,
    email,
    department_id: Number(department_id),
    role: 'staff', // everyone starts as staff; a Super Admin promotes people later
  });
  if (pErr) {
    await supabase.auth.signOut();
    throw new Error(pErr.code === '23505' ? 'That staff ID or email is already registered.' : pErr.message);
  }
  return (currentUser = await loadProfile(data.user.id));
}

export async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
}
