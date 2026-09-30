import { login } from '../auth.js';
import { go } from '../router.js';
import { showAlert } from '../ui.js';

export default function loginView(el) {
  el.innerHTML = `
    <div class="auth">
      <form class="card auth-card" id="f">
        <div class="brand dark"><span class="mark">KMA</span><span>IT Management</span></div>
        <h1>Sign in</h1>
        <p class="muted">Log IT issues, track requests, and manage devices for every department.</p>
        <label>Email<input name="email" type="email" required autocomplete="username" /></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password" /></label>
        <button class="btn" id="go">Sign in</button>
        <p class="muted center">KMA staff without an account? <a href="#/register">Register with your staff ID</a></p>
      </form>
    </div>`;

  const form = el.querySelector('#f');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#go');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await login(form.email.value.trim(), form.password.value);
      go('/');
    } catch (err) {
      await showAlert(err.message, { title: 'Could not sign in' });
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  };
}
