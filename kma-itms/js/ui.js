// Small helpers shared by every view.

// Escape user-entered text before putting it inside HTML (prevents XSS).
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pretty = (s) => String(s ?? '').replace(/_/g, ' ');
export const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—');

export const badge = (value) =>
  `<span class="badge b-${esc(String(value).replace(/_/g, '-'))}">${esc(pretty(value))}</span>`;

export const stat = (label, value, tone = '') =>
  `<div class="stat ${tone}"><div class="stat-value">${esc(value ?? '—')}</div><div class="stat-label">${esc(label)}</div></div>`;

export function bars(data = []) {
  if (!data.length) return '<p class="muted">Nothing to show yet.</p>';
  const max = Math.max(1, ...data.map((d) => d.count));
  return `<div class="bars">${data
    .map(
      (d) => `<div class="bar-row">
        <span class="bar-label" title="${esc(pretty(d.label))}">${esc(pretty(d.label))}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(d.count / max) * 100}%"></div></div>
        <b>${d.count}</b></div>`
    )
    .join('')}</div>`;
}

export const msg = (error, ok) =>
  error ? `<p class="alert err" role="alert">${esc(error)}</p>` : ok ? `<p class="alert ok">${esc(ok)}</p>` : '';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/* ---------- modals ----------
   One shared overlay element, reused for every alert/confirm so only one can
   ever be open at a time. showAlert() replaces the old inline error/success
   banners for action feedback; showConfirm() is for "are you sure?" prompts
   before a destructive click (deactivating someone, changing their role). */
function modalRoot() {
  let root = document.getElementById('modalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modalRoot';
    document.body.appendChild(root);
  }
  return root;
}

export function closeModal() {
  modalRoot().innerHTML = '';
}

export function showAlert(message, { title = '', kind = 'err' } = {}) {
  return new Promise((resolve) => {
    const root = modalRoot();
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal card" role="alertdialog" aria-modal="true">
          ${title ? `<h2>${esc(title)}</h2>` : ''}
          <p class="prewrap${kind === 'ok' ? ' good-text' : ' bad-text'}">${esc(message)}</p>
          <div class="modal-actions"><button class="btn" id="modalOk">OK</button></div>
        </div>
      </div>`;
    const done = () => { closeModal(); resolve(); };
    root.querySelector('#modalOk').onclick = done;
    root.querySelector('.modal-overlay').addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('modal-overlay')) done();
    });
    root.querySelector('#modalOk').focus();
  });
}

export function showConfirm({ title = 'Are you sure?', body = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const root = modalRoot();
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal card" role="alertdialog" aria-modal="true">
          <h2>${esc(title)}</h2>
          ${body ? `<p>${esc(body)}</p>` : ''}
          <div class="modal-actions">
            <button class="btn ghost" id="modalCancel">${esc(cancelText)}</button>
            <button class="btn${danger ? ' danger' : ''}" id="modalConfirm">${esc(confirmText)}</button>
          </div>
        </div>
      </div>`;
    const finish = (val) => { closeModal(); resolve(val); };
    root.querySelector('#modalCancel').onclick = () => finish(false);
    root.querySelector('#modalConfirm').onclick = () => finish(true);
    root.querySelector('.modal-overlay').addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('modal-overlay')) finish(false);
    });
    root.querySelector('#modalConfirm').focus();
  });
}
