import { getAssetDetail, addHistory, STATUSES } from '../api/assets.js';
import { esc, badge, fmt, showAlert } from '../ui.js';

export default async function assetDetailView(el, { id }) {
  let { asset: a, history } = await getAssetDetail(id);

  const rows = [
    ['Type', a.type], ['Brand', a.brand], ['Model', a.model], ['Serial number', a.serial_number],
    ['Department', a.department?.name], ['Brought in by', a.brought_in_by], ['Notes', a.notes],
  ];

  function historyHtml() {
    if (!history.length) return '<p class="muted">No history yet.</p>';
    return `<ol class="timeline">${history.map((h) => `
      <li>
        <b>${esc(h.event)}</b>
        ${h.notes ? `<p class="prewrap">${esc(h.notes)}</p>` : ''}
        <small>${esc(h.performer?.full_name || 'System')} · ${fmt(h.created_at)}</small>
      </li>`).join('')}</ol>`;
  }

  el.innerHTML = `
    <div class="page-head">
      <div><a href="#/assets" class="link">← Asset registry</a><h1>${esc(a.asset_tag)}</h1></div>
      ${badge(a.status)}
    </div>
    <div class="grid2">
      <section class="card">
        <h2>Details</h2>
        <dl class="dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>
      </section>
      <section class="card">
        <h2>History</h2>
        <form class="form" id="histForm">
          <input name="event" required placeholder="What happened? e.g. Screen replaced" />
          <textarea name="notes" rows="2" placeholder="Notes (optional)"></textarea>
          <select name="status" aria-label="Update status">
            <option value="">Keep current status</option>
            <option value="in_service">Back in service</option>
            <option value="under_repair">Under repair</option>
            <option value="in_storage">In storage</option>
            <option value="retired">Retired</option>
          </select>
          <button class="btn">Add to history</button>
        </form>
        <div id="timeline">${historyHtml()}</div>
      </section>
    </div>`;

  el.querySelector('#histForm').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await addHistory(id, { event: form.event.value, notes: form.notes.value, status: form.status.value });
      ({ asset: a, history } = await getAssetDetail(id));
      form.reset();
      el.querySelector('#timeline').innerHTML = historyHtml();
    } catch (err) {
      await showAlert(err.message, { title: 'Could not add to history' });
    }
  };
}
