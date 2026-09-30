import { getSummary } from '../api/reports.js';
import { stat, bars, msg } from '../ui.js';

export default async function reportsView(el) {
  let r;
  try {
    r = await getSummary();
  } catch (err) {
    el.innerHTML = msg(err.message);
    return;
  }
  const t = r.totals;

  el.innerHTML = `
    <div class="page-head">
      <h1>Reports</h1>
      <button class="btn ghost no-print" id="printBtn">Print / save as PDF</button>
    </div>
    <div class="stats">
      ${stat('Total complaints', t.complaints)}
      ${stat('Resolved', t.resolved, 'good')}
      ${stat('Open tasks', t.tasks_open)}
      ${stat('Overdue tasks', t.tasks_overdue, t.tasks_overdue ? 'bad' : '')}
      ${stat('Registered assets', t.assets)}
      ${stat('Avg. hours to resolve', t.avg_resolution_hours ?? '—')}
    </div>
    <div class="grid3">
      <section class="card"><h2>Complaints by status</h2>${bars(r.complaints_by_status)}</section>
      <section class="card"><h2>Complaints by priority</h2>${bars(r.complaints_by_priority)}</section>
      <section class="card"><h2>Complaints per month</h2>${bars(r.complaints_monthly)}</section>
      <section class="card"><h2>Complaints by department</h2>${bars(r.complaints_by_department)}</section>
      <section class="card"><h2>Team workload</h2>${bars(r.workload)}</section>
      <section class="card"><h2>Tasks by status</h2>${bars(r.tasks_by_status)}</section>
      <section class="card"><h2>Assets by status</h2>${bars(r.assets_by_status)}</section>
      <section class="card"><h2>Assets by department</h2>${bars(r.assets_by_department)}</section>
      <section class="card"><h2>Assets by type</h2>${bars(r.assets_by_type)}</section>
    </div>`;

  el.querySelector('#printBtn').onclick = () => window.print();
}
