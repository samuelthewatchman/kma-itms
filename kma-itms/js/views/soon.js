// Placeholder for pages we haven't built yet.
import { esc } from '../ui.js';

export default function soon(el, { title }) {
  el.innerHTML = `
    <div class="page-head"><h1>${esc(title || 'Coming next')}</h1></div>
    <section class="card"><p class="muted">This page is next on our build list.</p></section>`;
}
