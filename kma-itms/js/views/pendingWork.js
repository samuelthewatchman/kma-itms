import { listTasks, createTask, patchTask, PRIORITIES, STATUSES } from '../api/tasks.js';
import { listTechnicians } from '../api/users.js';
import { esc, badge, fmtDate, msg, showAlert } from '../ui.js';

const blank = { title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' };
const isOverdue = (t) => t.status !== 'resolved' && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());

export default async function pendingWorkView(el) {
  const techs = await listTechnicians();
  let filter = { status: '', mine: false };
  let formOpen = false;
  let form = { ...blank };

  function techOptions(selectedId) {
    return techs.map((t) => `<option value="${t.id}"${String(selectedId) === String(t.id) ? ' selected' : ''}>${esc(t.full_name)}</option>`).join('');
  }

  function rowsHtml(list) {
    if (!list.length) return '<tr><td colspan="5" class="muted center">No tasks here. Marking a complaint "In progress" adds one automatically.</td></tr>';
    return list.map((t) => `
      <tr class="${t.status === 'resolved' ? 'done' : ''}" data-id="${t.id}">
        <td>
          <b>${esc(t.title)}</b>
          ${t.complaint_id ? `<small><a href="#/complaints/${t.complaint_id}">From complaint #${t.complaint_id}</a></small>` : ''}
          ${t.asset?.asset_tag ? `<small>Asset ${esc(t.asset.asset_tag)}</small>` : ''}
        </td>
        <td>
          <select class="assignSel" data-id="${t.id}">
            <option value="">Unassigned</option>
            ${techOptions(t.assigned_to)}
          </select>
        </td>
        <td>${badge(t.priority)}</td>
        <td class="${isOverdue(t) ? 'late' : ''}">${fmtDate(t.due_date)}${isOverdue(t) ? '<small>Overdue</small>' : ''}</td>
        <td>
          <select class="statusSel" data-id="${t.id}">
            ${STATUSES.map((s) => `<option value="${s}"${s === t.status ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
  }

  function formHtml() {
    if (!formOpen) return '';
    return `
      <form class="card form grid-form" id="taskForm">
        <label class="span2">Task<input name="title" required value="${esc(form.title)}" /></label>
        <label class="span2">Details<textarea name="description" rows="2">${esc(form.description)}</textarea></label>
        <label>Priority
          <select name="priority">${PRIORITIES.map((p) => `<option value="${p}"${p === form.priority ? ' selected' : ''}>${p}</option>`).join('')}</select>
        </label>
        <label>Assign to
          <select name="assigned_to"><option value="">Me</option>${techOptions(form.assigned_to)}</select>
        </label>
        <label>Due date<input type="date" name="due_date" value="${form.due_date}" /></label>
        <div class="span2"><button class="btn">Save task</button></div>
      </form>`;
  }

  async function draw() {
    el.innerHTML = `
      <div class="page-head">
        <h1>Pending work</h1>
        <div class="actions">
          <label class="check"><input type="checkbox" id="mineChk" ${filter.mine ? 'checked' : ''}/> Assigned to me</label>
          <select id="statusFilter" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="open"${filter.status === 'open' ? ' selected' : ''}>Open</option>
            <option value="in_progress"${filter.status === 'in_progress' ? ' selected' : ''}>In progress</option>
            <option value="resolved"${filter.status === 'resolved' ? ' selected' : ''}>Resolved</option>
          </select>
          <button class="btn" id="toggleForm">${formOpen ? 'Cancel' : 'Add task'}</button>
        </div>
      </div>
      ${formHtml()}
      <div class="card table-wrap">
        <table>
          <thead><tr><th>Task</th><th>Assigned to</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead>
          <tbody id="rows"><tr><td colspan="5" class="muted center">Loading…</td></tr></tbody>
        </table>
      </div>`;

    el.querySelector('#mineChk').onchange = (e) => { filter.mine = e.target.checked; draw(); };
    el.querySelector('#statusFilter').onchange = (e) => { filter.status = e.target.value; draw(); };
    el.querySelector('#toggleForm').onclick = () => { formOpen = !formOpen; if (formOpen) form = { ...blank }; draw(); };

    const taskForm = el.querySelector('#taskForm');
    if (taskForm) {
      taskForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await createTask({
            title: taskForm.title.value,
            description: taskForm.description.value,
            priority: taskForm.priority.value,
            assigned_to: taskForm.assigned_to.value || null,
            due_date: taskForm.due_date.value || null,
          });
          formOpen = false;
          await draw();
        } catch (err) {
          await showAlert(err.message, { title: 'Could not save task' });
        }
      };
    }

    try {
      const list = await listTasks(filter);
      el.querySelector('#rows').innerHTML = rowsHtml(list);
      el.querySelectorAll('.assignSel').forEach((sel) => {
        sel.onchange = async () => {
          try {
            const t = list.find((x) => String(x.id) === sel.dataset.id);
            await patchTask(t, { assigned_to: sel.value || null });
            draw();
          } catch (err) { await showAlert(err.message, { title: 'Could not reassign task' }); }
        };
      });
      el.querySelectorAll('.statusSel').forEach((sel) => {
        sel.onchange = async () => {
          try {
            const t = list.find((x) => String(x.id) === sel.dataset.id);
            await patchTask(t, { status: sel.value });
            draw();
          } catch (err) { await showAlert(err.message, { title: 'Could not update status' }); }
        };
      });
    } catch (err) {
      el.innerHTML = msg(err.message);
    }
  }

  draw();
}
