import { supabase } from '../supabaseClient.js';
import { getUser, isAdmin } from '../auth.js';
import { esc, fmt, badge, stat, bars } from '../ui.js';

// count rows in a table that match a filter function
async function count(table, apply = (q) => q) {
  const { count: n } = await apply(supabase.from(table).select('*', { count: 'exact', head: true }));
  return n ?? 0;
}

function recentList(items) {
  if (!items.length) return '<p class="muted">No complaints yet.</p>';
  return `<div class="list">${items.slice(0, 6).map((c) => `
    <a class="row" href="#/complaints/${c.id}">
      <span><b>${esc(c.title)}</b><small>${esc(c.profile?.full_name)} · ${fmt(c.created_at)}</small></span>
      ${badge(c.status)}
    </a>`).join('')}</div>`;
}

export default async function dashboard(el) {
  const user = getUser();
  const admin = isAdmin();

  // RLS means staff automatically only get their own complaints back; admins get everyone's
  const { data: complaints = [] } = await supabase
    .from('complaints')
    .select('id,title,status,created_at,profile:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  const list = complaints || [];
  const mine = (s) => list.filter((c) => c.status === s).length;

  let statsHtml = '';
  let sideCard = '';

  if (admin) {
    const today = new Date().toISOString().slice(0, 10);
    const [open, inProgress, overdue, repair, resolved, open_tasks] = await Promise.all([
      count('complaints', (q) => q.eq('status', 'open')),
      count('complaints', (q) => q.eq('status', 'in_progress')),
      count('tasks', (q) => q.neq('status', 'resolved').lt('due_date', today)),
      count('assets', (q) => q.eq('status', 'under_repair')),
      supabase.from('complaints').select('created_at,resolved_at').not('resolved_at', 'is', null),
      supabase.from('tasks').select('assignee:assigned_to(full_name)').neq('status', 'resolved'),
    ]);

    const done = resolved.data || [];
    const avg = done.length
      ? (done.reduce((s, c) => s + (new Date(c.resolved_at) - new Date(c.created_at)), 0) / done.length / 36e5).toFixed(1)
      : '—';

    const load = {};
    (open_tasks.data || []).forEach((t) => {
      const name = t.assignee?.full_name || 'Unassigned';
      load[name] = (load[name] || 0) + 1;
    });
    const workload = Object.entries(load).map(([label, n]) => ({ label, count: n })).sort((a, b) => b.count - a.count);

    statsHtml = `<div class="stats">
      ${stat('Open complaints', open, 'warn')}
      ${stat('In progress', inProgress)}
      ${stat('Tasks overdue', overdue, overdue ? 'bad' : '')}
      ${stat('Assets under repair', repair)}
      ${stat('Avg. hours to resolve', avg)}
    </div>`;
    sideCard = `<section class="card"><h2>Team workload</h2>
      <p class="muted">Unresolved tasks per technician</p>${bars(workload)}</section>`;
  } else {
    statsHtml = `<div class="stats">
      ${stat('Open', mine('open'), 'warn')}
      ${stat('In progress', mine('in_progress'))}
      ${stat('Resolved', mine('resolved') + mine('closed'), 'good')}
    </div>`;
  }

  el.innerHTML = `
    <div class="page-head">
      <h1>Welcome, ${esc(user.full_name.split(' ')[0])}</h1>
      ${admin ? '' : '<a class="btn" href="#/complaints/new">Report an IT issue</a>'}
    </div>
    ${statsHtml}
    <div class="grid2">
      <section class="card">
        <div class="card-head"><h2>${admin ? 'Latest complaints' : 'Your recent requests'}</h2><a href="#/complaints" class="link">View all</a></div>
        ${recentList(list)}
      </section>
      ${sideCard}
    </div>`;
}
