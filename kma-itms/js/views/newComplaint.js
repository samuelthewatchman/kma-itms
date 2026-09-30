import { createComplaint, PRIORITIES } from '../api/complaints.js';
import { go } from '../router.js';
import { showAlert } from '../ui.js';

export default function newComplaintView(el) {
  el.innerHTML = `
    <div class="page-head"><h1>Report an IT issue</h1></div>
    <form class="card form narrow" id="f">
      <label>What is the problem?<input name="title" required maxlength="140" placeholder="e.g. Printer in Finance office not working" /></label>
      <label>Details<textarea name="description" required rows="6" placeholder="What happened, where, and since when?"></textarea></label>
      <label>Priority
        <select name="priority">
          ${PRIORITIES.map((p) => `<option value="${p}"${p === 'medium' ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </label>
      <button class="btn" id="go">Send to IT</button>
    </form>`;

  const form = el.querySelector('#f');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#go');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const c = await createComplaint({
        title: form.title.value,
        description: form.description.value,
        priority: form.priority.value,
      });
      go(`/complaints/${c.id}`);
    } catch (err) {
      await showAlert(err.message, { title: 'Could not send' });
      btn.disabled = false; btn.textContent = 'Send to IT';
    }
  };
}
