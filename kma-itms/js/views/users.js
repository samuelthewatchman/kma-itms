import { supabase } from '../supabaseClient.js';
import { getUser } from '../auth.js';
import { listUsers, listPendingInvites, inviteAdmin, cancelInvite, toggleActive, toggleRole } from '../api/users.js';
import { esc, badge, fmtDate, msg, showAlert, showConfirm } from '../ui.js';

const blank = { staff_id: '', full_name: '', email: '', department_id: '' };

export default async function usersView(el) {
  const { data: depts } = await supabase.from('departments').select('id,name').order('name');
  let formOpen = false;

  function inviteFormHtml() {
    if (!formOpen) return '';
    return `
      <form class="card form grid-form" id="inviteForm">
        <label>Staff ID<input name="staff_id" required /></label>
        <label>Full name<input name="full_name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Department
          <select name="department_id">
            <option value="">Select department</option>
            ${(depts || []).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
          </select>
        </label>
        <div class="span2">
          <button class="btn">Send invite</button>
          <p class="muted">They'll register themselves at <b>/register</b> using this email — doing so automatically makes them an IT Admin instead of Staff.</p>
        </div>
      </form>`;
  }

  function usersRowsHtml(list) {
    return list.map((u) => {
      const isSelf = u.id === getUser().id;
      const locked = u.role === 'super_admin' || isSelf;
      return `
        <tr class="${u.is_active ? '' : 'done'}">
          <td><b>${esc(u.full_name)}</b><small>${esc(u.email)}</small></td>
          <td>${esc(u.staff_id)}</td>
          <td>${esc(u.department?.name || '—')}</td>
          <td>${badge(u.role)}</td>
          <td>${fmtDate(u.created_at)}</td>
          <td class="right">
            ${locked ? '' : `
              <div class="actions">
                <button class="btn ghost sm roleBtn" data-id="${u.id}">${u.role === 'staff' ? 'Make IT Admin' : 'Make Staff'}</button>
                <button class="btn sm${u.is_active ? ' danger' : ''} activeBtn" data-id="${u.id}">${u.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>`}
          </td>
        </tr>`;
    }).join('');
  }

  function invitesHtml(list) {
    if (!list.length) return '';
    return `
      <section class="card">
        <h2>Pending invites</h2>
        <div class="list">
          ${list.map((p) => `
            <div class="row">
              <span><b>${esc(p.full_name)}</b><small>${esc(p.email)} · ${esc(p.department?.name || 'No department')} · invited ${fmtDate(p.created_at)}</small></span>
              <button class="link cancelBtn" data-email="${esc(p.email)}">Cancel invite</button>
            </div>`).join('')}
        </div>
      </section>`;
  }

  async function draw() {
    let users, invites;
    try {
      [users, invites] = await Promise.all([listUsers(), listPendingInvites()]);
    } catch (err) {
      el.innerHTML = msg(err.message);
      return;
    }

    el.innerHTML = `
      <div class="page-head">
        <h1>Users</h1>
        <button class="btn" id="toggleForm">${formOpen ? 'Cancel' : 'Invite IT Admin'}</button>
      </div>
      ${inviteFormHtml()}
      ${invitesHtml(invites)}
      <div class="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Staff ID</th><th>Department</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>${usersRowsHtml(users)}</tbody>
        </table>
      </div>`;

    el.querySelector('#toggleForm').onclick = () => { formOpen = !formOpen; draw(); };

    const inviteForm = el.querySelector('#inviteForm');
    if (inviteForm) {
      inviteForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await inviteAdmin({
            staff_id: inviteForm.staff_id.value,
            full_name: inviteForm.full_name.value,
            email: inviteForm.email.value,
            department_id: inviteForm.department_id.value || null,
          });
          formOpen = false;
          await draw();
        } catch (err) {
          await showAlert(err.message);
        }
      };
    }

    el.querySelectorAll('.roleBtn').forEach((b) => b.onclick = async () => {
      const u = users.find((x) => x.id === b.dataset.id);
      const toIt = u.role === 'staff';
      const ok = await showConfirm({
        title: toIt ? 'Make this person an IT Admin?' : 'Move this person back to Staff?',
        body: toIt
          ? `${u.full_name} will be able to manage complaints, tasks, assets and reports.`
          : `${u.full_name} will lose IT Admin access and go back to a regular staff account.`,
        confirmText: toIt ? 'Make IT Admin' : 'Make Staff',
      });
      if (!ok) return;
      try { await toggleRole(u); await draw(); }
      catch (err) { await showAlert(err.message); }
    });
    el.querySelectorAll('.activeBtn').forEach((b) => b.onclick = async () => {
      const u = users.find((x) => x.id === b.dataset.id);
      const deactivating = u.is_active;
      const ok = await showConfirm({
        title: deactivating ? 'Deactivate this account?' : 'Activate this account?',
        body: deactivating
          ? `${u.full_name} won't be able to sign in until reactivated.`
          : `${u.full_name} will be able to sign in again.`,
        confirmText: deactivating ? 'Deactivate' : 'Activate',
        danger: deactivating,
      });
      if (!ok) return;
      try { await toggleActive(u); await draw(); }
      catch (err) { await showAlert(err.message); }
    });
    el.querySelectorAll('.cancelBtn').forEach((b) => b.onclick = async () => {
      try { await cancelInvite(b.dataset.email); await draw(); }
      catch (err) { await showAlert(err.message); }
    });
  }

  draw();
}
