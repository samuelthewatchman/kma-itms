import { register } from '../auth.js';
import { supabase } from '../supabaseClient.js';
import { go } from '../router.js';
import { esc, showAlert } from '../ui.js';

export default async function registerView(el) {
  const { data: depts } = await supabase.from('departments').select('id,name').order('name');

  el.innerHTML = `
    <div class="auth">
      <form class="card auth-card" id="f">
        <div class="brand dark"><span class="mark">KMA</span><span>IT Management</span></div>
        <h1>Create your staff account</h1>
        <label>Staff ID<input name="staff_id" required /></label>
        <label>Full name<input name="full_name" required /></label>
        <label>Work email<input name="email" type="email" required /></label>
        <label>Department
          <select name="department_id" required>
            <option value="">Select your department</option>
            ${(depts || []).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
          </select>
        </label>
        <label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password" /><small class="muted">At least 8 characters</small></label>
        <button class="btn" id="go">Create account</button>
        <p class="muted center">Already registered? <a href="#/login">Sign in</a></p>
      </form>
    </div>`;

  const form = el.querySelector('#f');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#go');
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      await register({
        staff_id: form.staff_id.value.trim(),
        full_name: form.full_name.value.trim(),
        email: form.email.value.trim(),
        department_id: form.department_id.value,
        password: form.password.value,
      });
      go('/');
    } catch (err) {
      await showAlert(err.message, { title: 'Could not create account' });
      btn.disabled = false; btn.textContent = 'Create account';
    }
  };
}
