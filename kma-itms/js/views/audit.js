import { getAuditLog } from '../api/reports.js';
import { esc, fmt, pretty, msg } from '../ui.js';

export default async function auditView(el) {
  el.innerHTML = `
    <div class="page-head"><h1>Audit log</h1></div>
    <p class="muted">Who did what, and when. Showing the latest 300 actions.</p>
    <div id="err"></div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
        <tbody id="rows"><tr><td colspan="5" class="muted center">Loading…</td></tr></tbody>
      </table>
    </div>`;

  try {
    const log = await getAuditLog();
    el.querySelector('#rows').innerHTML = log.length
      ? log.map((l) => `
        <tr>
          <td>${fmt(l.created_at)}</td>
          <td>${esc(l.user?.full_name || 'System')}<small>${esc(pretty(l.user?.role))}</small></td>
          <td>${esc(pretty(l.action))}</td>
          <td>${esc(l.entity)}${l.entity_id ? ` #${l.entity_id}` : ''}</td>
          <td><small>${esc(Object.entries(l.details || {}).map(([k, v]) => `${k}: ${v}`).join(', '))}</small></td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="muted center">No actions logged yet.</td></tr>';
  } catch (err) {
    el.querySelector('#rows').innerHTML = '';
    el.querySelector('#err').innerHTML = msg(err.message);
  }
}
