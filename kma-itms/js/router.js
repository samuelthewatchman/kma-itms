// Tiny hash router. URLs look like  index.html#/complaints/5
// Swapping the hash never reloads the page, which is what makes this a "single page app".
import { getUser, isAdmin, isSuper } from './auth.js';

// access: 'public' (anyone) | 'auth' (any signed-in user) | 'admin' (IT admin + super admin) | 'super'
const routes = [
  { path: '/login', access: 'public', bare: true, view: () => import('./views/login.js') },
  { path: '/register', access: 'public', bare: true, view: () => import('./views/register.js') },
  { path: '/', access: 'auth', view: () => import('./views/dashboard.js') },
  // Pages we haven't built yet all show a "coming next" screen for now
  { path: '/complaints', access: 'auth', view: () => import('./views/complaints.js'), title: 'Complaints' },
  { path: '/complaints/new', access: 'auth', view: () => import('./views/newComplaint.js'), title: 'New complaint' },
  { path: '/complaints/:id', access: 'auth', view: () => import('./views/complaintDetail.js'), title: 'Complaint' },
  { path: '/pending-work', access: 'admin', view: () => import('./views/pendingWork.js'), title: 'Pending work' },
  { path: '/assets', access: 'admin', view: () => import('./views/assets.js'), title: 'Asset registry' },
  { path: '/assets/:id', access: 'admin', view: () => import('./views/assetDetail.js'), title: 'Asset' },
  { path: '/reports', access: 'admin', view: () => import('./views/reports.js'), title: 'Reports' },
  { path: '/users', access: 'super', view: () => import('./views/users.js'), title: 'Users' },
  { path: '/audit', access: 'super', view: () => import('./views/audit.js'), title: 'Audit log' },
];

// Turn '/complaints/:id' + '/complaints/5' into { id: '5' }
function match(pattern, path) {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export const currentPath = () => (location.hash.slice(1).split('?')[0] || '/');
export const go = (path) => { location.hash = '#' + path; };

function allowed(access) {
  if (access === 'public') return true;
  if (!getUser()) return false;
  if (access === 'admin') return isAdmin();
  if (access === 'super') return isSuper();
  return true;
}

// Work out which route the current URL points at and whether this person may see it.
// Returns { route, params } or { redirect: '/somewhere' }
export function resolve() {
  const path = currentPath();
  // /complaints/new must win over /complaints/:id, so exact matches are tried first
  const ordered = [...routes].sort((x, y) => x.path.includes(':') - y.path.includes(':'));
  for (const route of ordered) {
    const params = match(route.path, path);
    if (!params) continue;
    if (!getUser() && route.access !== 'public') return { redirect: '/login' };
    if (getUser() && route.access === 'public') return { redirect: '/' };
    if (!allowed(route.access)) return { redirect: '/' };
    return { route, params };
  }
  return { redirect: getUser() ? '/' : '/login' };
}
