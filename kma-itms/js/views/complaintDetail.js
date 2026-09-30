import { getUser, isAdmin } from '../auth.js';
import { getComplaintDetail, sendMessage, updateStatus, STATUSES } from '../api/complaints.js';
import { listTechnicians } from '../api/users.js';
import { esc, badge, fmt, fmtDate, showAlert } from '../ui.js';

export default async function complaintDetailView(el, { id }) {
  const admin = isAdmin();
  let { complaint: c, messages, task } = await getComplaintDetail(id);
  const techs = admin ? await listTechnicians() : [];

  function threadHtml() {
    if (!messages.length) return '<p class="muted">No replies yet.</p>';
    return messages.map((m) => `
      <div class="bubble ${m.sender_id === getUser().id ? 'me' : ''}">
        <small><b>${esc(m.sender?.full_name)}</b>${m.sender?.role !== 'staff' ? ' (IT)' : ''} · ${fmt(m.created_at)}</small>
        <p class="prewrap">${esc(m.body)}</p>
      </div>`).join('');
  }

  function draw() {
    el.innerHTML = `
      <div class="page-head">
        <div>
          <a href="#/complaints" class="link">← Complaints</a>
          <h1>${esc(c.title)}</h1>
        </div>
        <div class="actions">${badge(c.priority)}${badge(c.status)}</div>
      </div>

      <div class="grid2 wide-left">
        <section class="card">
          <p class="meta">Logged by <b>${esc(c.profile?.full_name)}</b> (${esc(c.profile?.staff_id)})${c.profile?.department?.name ? `, ${esc(c.profile.department.name)}` : ''} on ${fmt(c.created_at)}</p>
          <p class="prewrap">${esc(c.description)}</p>
          <hr />
          <h2>Conversation</h2>
          <div class="thread">${threadHtml()}</div>
          ${c.status !== 'closed' ? `
            <form id="replyForm" class="form">
              <textarea name="body" required rows="3" placeholder="Write a reply…"></textarea>
              <button class="btn" id="replyBtn">Send reply</button>
            </form>` : '<p class="muted">This complaint is closed.</p>'}
        </section>

        ${admin ? `
          <aside class="card form" id="manage">
            <h2>Manage</h2>
            <label>Status
              <select id="statusSel">
                ${STATUSES.map((s) => `<option value="${s}"${s === c.status ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
              </select>
            </label>
            <div id="taskFields"></div>
            <button class="btn" id="updateBtn" disabled>Update status</button>
            ${task ? `
              <div class="linked">
                <b>Linked task</b>
                <span>${esc(task.assignee?.full_name || 'Unassigned')} · due ${fmtDate(task.due_date)}</span>
                ${badge(task.status)}
              </div>` : ''}
          </aside>` : ''}
      </div>`;

    // reply form
    const replyForm = el.querySelector('#replyForm');
    if (replyForm) {
      replyForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = el.querySelector('#replyBtn');
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          await sendMessage(c, replyForm.body.value);
          ({ complaint: c, messages, task } = await getComplaintDetail(id));
          draw();
        } catch (err) {
          await showAlert(err.message, { title: 'Could not send reply' });
          btn.disabled = false; btn.textContent = 'Send reply';
        }
      };
    }

    // admin manage panel
    if (admin) {
      const sel = el.querySelector('#statusSel');
      const taskFields = el.querySelector('#taskFields');
      const updateBtn = el.querySelector('#updateBtn');

      const drawTaskFields = () => {
        if (sel.value === 'in_progress' && !task) {
          taskFields.innerHTML = `
            <label>Assign to
              <select id="assignSel">
                <option value="">Me</option>
                ${techs.map((t) => `<option value="${t.id}">${esc(t.full_name)}</option>`).join('')}
              </select>
            </label>
            <label>Due date<input type="date" id="dueDate" /></label>
            <p class="muted">A linked task will be added to Pending work.</p>`;
        } else {
          taskFields.innerHTML = '';
        }
        updateBtn.disabled = sel.value === c.status;
      };
      sel.onchange = drawTaskFields;
      drawTaskFields();

      updateBtn.onclick = async () => {
        updateBtn.disabled = true;
        const assignEl = el.querySelector('#assignSel');
        const dueEl = el.querySelector('#dueDate');
        try {
          const r = await updateStatus(c, {
            status: sel.value,
            assigned_to: assignEl ? assignEl.value || null : null,
            due_date: dueEl ? dueEl.value || null : null,
          });
          ({ complaint: c, messages, task } = await getComplaintDetail(id));
          draw();
          await showAlert(r.taskCreated ? 'Status updated and a task was added to Pending work.' : 'Status updated.', { title: 'Done', kind: 'ok' });
        } catch (err) {
          await showAlert(err.message, { title: 'Could not update status' });
          updateBtn.disabled = false;
        }
      };
    }
  }

  draw();
}
