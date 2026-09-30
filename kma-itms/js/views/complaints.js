import { isAdmin } from '../auth.js';
import { listComplaints } from '../api/complaints.js';
import { esc, badge, fmt, showAlert } from '../ui.js';

function rowsHtml(list, admin) {
  if (!list.length) {
    return `<tr><td colspan="${admin ? 6 : 5}" class="muted center">${admin ? 'No complaints match this filter.' : 'You have not logged any complaints yet.'}</td></tr>`;
  }
  return list.map((c) => `
    <tr>
      <td>${c.id}</td>
      <td><a href="#/complaints/${c.id}"><b>${esc(c.title)}</b></a></td>
      ${admin ? `<td>${esc(c.profile?.full_name)}<small>${esc(c.profile?.department?.name || '')}</small></td>` : ''}
      <td>${badge(c.priority)}</td>
      <td>${badge(c.status)}</td>
      <td>${fmt(c.created_at)}</td>
    </tr>`).join('');
}

export default async function complaintsView(el) {
  const admin = isAdmin();

  el.innerHTML = `
    <div class="page-head">
      <h1>${admin ? 'Staff complaints' : 'My complaints'}</h1>
      <div class="actions">
        <select id="statusFilter" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        ${admin ? '' : '<a class="btn" href="#/complaints/new">New complaint</a>'}
      </div>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>#</th><th>Issue</th>${admin ? '<th>Staff</th>' : ''}<th>Priority</th><th>Status</th><th>Logged</th></tr></thead>
        <tbody id="rows"><tr><td colspan="${admin ? 6 : 5}" class="muted center">Loading…</td></tr></tbody>
      </table>
    </div>`;

  const load = async (status) => {
    try {
      const list = await listComplaints(status || undefined);
      el.querySelector('#rows').innerHTML = rowsHtml(list, admin);
    } catch (err) {
      await showAlert(err.message, { title: 'Could not load complaints' });
    }
  };

  el.querySelector('#statusFilter').onchange = (e) => load(e.target.value);
  load('');
}
