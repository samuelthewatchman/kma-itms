import { supabase } from '../supabaseClient.js';
import { listAssets, createAsset, STATUSES } from '../api/assets.js';
import { esc, badge, fmtDate, showAlert } from '../ui.js';

const blank = { asset_tag: '', type: '', brand: '', model: '', serial_number: '', department_id: '', brought_in_by: '', status: 'in_service', notes: '' };

function rowsHtml(list) {
  if (!list.length) return '<tr><td colspan="6" class="muted center">No devices found. Register the first one to start the register.</td></tr>';
  return list.map((a) => `
    <tr>
      <td><a href="#/assets/${a.id}"><b>${esc(a.asset_tag)}</b></a></td>
      <td>${esc(a.type)}<small>${esc([a.brand, a.model].filter(Boolean).join(' '))}</small></td>
      <td>${esc(a.department?.name || '—')}</td>
      <td>${esc(a.serial_number || '—')}</td>
      <td>${badge(a.status)}</td>
      <td>${fmtDate(a.created_at)}</td>
    </tr>`).join('');
}

export default async function assetsView(el) {
  const { data: depts } = await supabase.from('departments').select('id,name').order('name');
  let q = '';
  let status = '';
  let formOpen = false;
  let form = { ...blank };

  function formHtml() {
    if (!formOpen) return '';
    return `
      <form class="card form grid-form" id="assetForm">
        <label>Device type<input name="type" required placeholder="Laptop, Desktop, Printer…" value="${esc(form.type)}" /></label>
        <label>Asset tag<input name="asset_tag" placeholder="Leave blank to auto-generate" value="${esc(form.asset_tag)}" /></label>
        <label>Brand<input name="brand" value="${esc(form.brand)}" /></label>
        <label>Model<input name="model" value="${esc(form.model)}" /></label>
        <label>Serial number<input name="serial_number" value="${esc(form.serial_number)}" /></label>
        <label>Department
          <select name="department_id">
            <option value="">Select department</option>
            ${(depts || []).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
          </select>
        </label>
        <label>Brought in by<input name="brought_in_by" placeholder="Staff member's name" value="${esc(form.brought_in_by)}" /></label>
        <label>Status
          <select name="status">${STATUSES.map((s) => `<option value="${s}"${s === form.status ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select>
        </label>
        <label class="span2">Notes<textarea name="notes" rows="2">${esc(form.notes)}</textarea></label>
        <div class="span2"><button class="btn">Save device</button></div>
      </form>`;
  }

  async function draw() {
    el.innerHTML = `
      <div class="page-head">
        <h1>Asset registry</h1>
        <div class="actions">
          <input type="search" id="q" placeholder="Search tag, brand, serial…" value="${esc(q)}" />
          <select id="statusFilter" aria-label="Filter by status">
            <option value="">All statuses</option>
            ${STATUSES.map((s) => `<option value="${s}"${s === status ? ' selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
          </select>
          <button class="btn" id="toggleForm">${formOpen ? 'Cancel' : 'Register device'}</button>
        </div>
      </div>
      ${formHtml()}
      <div class="card table-wrap">
        <table>
          <thead><tr><th>Tag</th><th>Device</th><th>Department</th><th>Serial</th><th>Status</th><th>Registered</th></tr></thead>
          <tbody id="rows"><tr><td colspan="6" class="muted center">Loading…</td></tr></tbody>
        </table>
      </div>`;

    let t;
    el.querySelector('#q').oninput = (e) => { q = e.target.value; clearTimeout(t); t = setTimeout(load, 250); };
    el.querySelector('#statusFilter').onchange = (e) => { status = e.target.value; load(); };
    el.querySelector('#toggleForm').onclick = () => { formOpen = !formOpen; if (formOpen) form = { ...blank }; draw(); };

    const assetForm = el.querySelector('#assetForm');
    if (assetForm) {
      assetForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await createAsset({
            asset_tag: assetForm.asset_tag.value,
            type: assetForm.type.value,
            brand: assetForm.brand.value,
            model: assetForm.model.value,
            serial_number: assetForm.serial_number.value,
            department_id: assetForm.department_id.value || null,
            brought_in_by: assetForm.brought_in_by.value,
            status: assetForm.status.value,
            notes: assetForm.notes.value,
          });
          formOpen = false;
          await draw();
        } catch (err) {
          await showAlert(err.message, { title: 'Could not save device' });
        }
      };
    }

    load();
  }

  async function load() {
    try {
      const list = await listAssets({ q, status });
      el.querySelector('#rows').innerHTML = rowsHtml(list);
    } catch (err) {
      await showAlert(err.message, { title: 'Could not load assets' });
    }
  }

  draw();
}
