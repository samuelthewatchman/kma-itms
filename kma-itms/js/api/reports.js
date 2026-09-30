// Supabase equivalent of server/src/routes/reports.js. The old server did the
// grouping with SQL GROUP BY; PostgREST (what supabase-js talks to) doesn't do
// arbitrary aggregation like that from the browser, so this pulls the raw rows
// and groups them in JS instead — fine at this project's scale.
import { supabase } from '../supabaseClient.js';

function groupCount(rows, keyFn, { limit } = {}) {
  const counts = new Map();
  for (const row of rows) {
    const label = keyFn(row);
    if (label == null) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  let out = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (limit) out = out.slice(0, limit);
  return out;
}

export async function getSummary() {
  const [{ data: complaints }, { data: tasks }, { data: assets }] = await Promise.all([
    supabase.from('complaints').select('status,priority,created_at,resolved_at,profile:user_id(department:department_id(name))'),
    supabase.from('tasks').select('status,due_date,assigned_to,assignee:assigned_to(full_name)'),
    supabase.from('assets').select('status,type,department:department_id(name)'),
  ]);
  const C = complaints || [], T = tasks || [], A = assets || [];

  const complaints_by_status = groupCount(C, (c) => c.status);
  const complaints_by_priority = groupCount(C, (c) => c.priority);
  const complaints_by_department = groupCount(C, (c) => c.profile?.department?.name || 'No department', { limit: 10 });

  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recent = C.filter((c) => new Date(c.created_at) > sixMonthsAgo);
  const monthKey = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const monthSort = (d) => new Date(d).getFullYear() * 12 + new Date(d).getMonth();
  const monthMap = new Map();
  recent.forEach((c) => {
    const label = monthKey(c.created_at);
    if (!monthMap.has(label)) monthMap.set(label, { label, count: 0, sort: monthSort(c.created_at) });
    monthMap.get(label).count++;
  });
  const complaints_monthly = [...monthMap.values()].sort((a, b) => a.sort - b.sort).map(({ label, count }) => ({ label, count }));

  const resolved = C.filter((c) => c.resolved_at);
  const avg_resolution_hours = resolved.length
    ? Math.round((resolved.reduce((s, c) => s + (new Date(c.resolved_at) - new Date(c.created_at)), 0) / resolved.length / 36e5) * 10) / 10
    : null;

  const tasks_by_status = groupCount(T, (t) => t.status);
  const today = new Date(new Date().toDateString());
  const tasks_overdue = T.filter((t) => t.status !== 'resolved' && t.due_date && new Date(t.due_date) < today).length;
  const workload = groupCount(T.filter((t) => t.status !== 'resolved' && t.assignee), (t) => t.assignee.full_name);

  const assets_by_status = groupCount(A, (a) => a.status);
  const assets_by_department = groupCount(A, (a) => a.department?.name || 'Unassigned', { limit: 10 });
  const assets_by_type = groupCount(A, (a) => a.type, { limit: 10 });

  const get = (rows, key) => (rows.find((r) => r.label === key) || { count: 0 }).count;
  const sum = (rows) => rows.reduce((n, r) => n + r.count, 0);

  return {
    totals: {
      complaints: sum(complaints_by_status),
      open: get(complaints_by_status, 'open'),
      in_progress: get(complaints_by_status, 'in_progress'),
      resolved: get(complaints_by_status, 'resolved') + get(complaints_by_status, 'closed'),
      tasks_open: sum(tasks_by_status) - get(tasks_by_status, 'resolved'),
      tasks_overdue,
      assets: sum(assets_by_status),
      assets_under_repair: get(assets_by_status, 'under_repair'),
      avg_resolution_hours,
    },
    complaints_by_status, complaints_by_priority, complaints_by_department, complaints_monthly,
    tasks_by_status, workload,
    assets_by_status, assets_by_department, assets_by_type,
  };
}

export async function getAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id,action,entity,entity_id,details,created_at,user:user_id(full_name,role)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data || [];
}
