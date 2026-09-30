// App entry point: draws the sidebar/top bar, the notification bell, and swaps views.
import { supabase } from './supabaseClient.js';
import { initAuth, getUser, isAdmin, isSuper, logout } from './auth.js';
import { resolve, currentPath, go } from './router.js';
import { esc, pretty, fmt, msg } from './ui.js';

const app = document.getElementById('app');
let shellUp = false;
let notesChannel = null;
let renderToken = 0; // stops a slow page from overwriting a newer one

/* ---------- shell (sidebar + top bar) ---------- */
function navLinks() {
  const links = [['/', 'Dashboard']];
  links.push(['/complaints', isAdmin() ? 'Complaints' : 'My complaints']);
  if (isAdmin()) links.push(['/pending-work', 'Pending work'], ['/assets', 'Asset registry'], ['/reports', 'Reports']);
  if (isSuper()) links.push(['/users', 'Users'], ['/audit', 'Audit log']);
  return links.map(([to, text]) => `<a href="#${to}" data-path="${to}">${text}</a>`).join('');
}

function mountShell() {
  const u = getUser();
  app.innerHTML = `
    <div class="shell">
      <aside class="side" id="side">
        <div class="brand">
          <span class="mark">KMA</span>
          <div class="brand-text"><strong>Kumasi Metropolitan Assembly</strong><small>IT Management</small></div>
        </div>
        <nav>${navLinks()}</nav>
        <div class="who">
          <b>${esc(u.full_name)}</b>
          <small>${esc(pretty(u.role))}</small>
          <button class="link" id="signout">Sign out</button>
        </div>
      </aside>
      <div class="main">
        <header class="top">
          <button class="icon-btn menu-btn" id="menu" aria-label="Menu">☰</button>
          <span class="top-title">Kumasi Metropolitan Assembly</span>
          <div class="bell" id="bell"></div>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>`;
  shellUp = true;

  document.getElementById('menu').onclick = () => document.getElementById('side').classList.toggle('open');
  document.getElementById('side').addEventListener('click', (e) => {
    if (e.target.closest('nav a')) document.getElementById('side').classList.remove('open');
  });
  document.getElementById('signout').onclick = async () => {
    await logout();
    unmountShell();
    go('/login');
  };
  startBell();
}

function unmountShell() {
  shellUp = false;
  if (notesChannel) { supabase.removeChannel(notesChannel); notesChannel = null; }
}

function markActiveLink() {
  const p = currentPath();
  document.querySelectorAll('#side nav a').forEach((a) => {
    const to = a.dataset.path;
    const on = to === '/' ? p === '/' : p === to || p.startsWith(to + '/');
    a.classList.toggle('active', on);
  });
}

/* ---------- notification bell (live via Supabase Realtime) ---------- */
let notes = [];
let bellOpen = false;

async function loadNotes() {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', getUser().id)
    .order('created_at', { ascending: false })
    .limit(30);
  notes = data || [];
  drawBell();
}

function drawBell() {
  const el = document.getElementById('bell');
  if (!el) return;
  const unread = notes.filter((n) => !n.is_read).length;
  el.innerHTML = `
    <button class="icon-btn" id="bellBtn" aria-label="Notifications, ${unread} unread">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
      ${unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : ''}
    </button>
    ${bellOpen ? `
      <div class="drop card">
        <div class="drop-head"><b>Notifications</b>${unread ? '<button class="link" id="readAll">Mark all read</button>' : ''}</div>
        ${notes.length ? '' : '<p class="muted pad">You\'re all caught up.</p>'}
        ${notes.map((n) => `<button class="note ${n.is_read ? '' : 'unread'}" data-id="${n.id}"><span>${esc(n.message)}</span><small>${fmt(n.created_at)}</small></button>`).join('')}
      </div>` : ''}`;

  document.getElementById('bellBtn').onclick = () => { bellOpen = !bellOpen; drawBell(); };
  const all = document.getElementById('readAll');
  if (all) all.onclick = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', getUser().id).eq('is_read', false);
    loadNotes();
  };
  el.querySelectorAll('.note').forEach((b) => {
    b.onclick = async () => {
      const n = notes.find((x) => String(x.id) === b.dataset.id);
      if (n && !n.is_read) await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      bellOpen = false;
      await loadNotes();
      if (n && n.link) go(n.link);
    };
  });
}

function startBell() {
  bellOpen = false;
  loadNotes();
  // Realtime: Supabase pushes a message the instant a new notification row is inserted for me
  notesChannel = supabase
    .channel('my-notifications')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${getUser().id}` },
      () => loadNotes())
    .subscribe();
}

// close the dropdown when clicking anywhere else
document.addEventListener('mousedown', (e) => {
  if (bellOpen && !e.target.closest('#bell')) { bellOpen = false; drawBell(); }
});

/* ---------- rendering the current route ---------- */
async function render() {
  const token = ++renderToken;
  const r = resolve();
  if (r.redirect) return go(r.redirect);

  const { route, params } = r;
  let target;
  if (route.bare) {
    if (shellUp) unmountShell();
    app.innerHTML = '';
    target = app;
  } else {
    if (!shellUp) mountShell();
    markActiveLink();
    target = document.getElementById('content');
    target.innerHTML = '<p class="muted">Loading…</p>';
  }

  try {
    const mod = await route.view();
    if (token !== renderToken) return; // user already navigated somewhere else
    target.innerHTML = '';
    await mod.default(target, { ...params, title: route.title });
  } catch (err) {
    if (token !== renderToken) return;
    console.error(err);
    target.innerHTML = msg(err.message || 'Something went wrong.');
  }
}

/* ---------- start ---------- */
window.addEventListener('hashchange', render);
await initAuth();
render();

// PWA: caches the app's own files so it loads instantly on repeat visits and
// keeps working (mostly) if the connection drops. Your data still always comes
// live from Supabase — this only caches the code, never the data.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => console.warn('Service worker failed:', err));
  });
}
