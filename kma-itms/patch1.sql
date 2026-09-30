-- ============================================================
-- PATCH 1 — run once in Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) The Register page needs to read departments BEFORE anyone is signed in.
drop policy if exists "departments_select" on departments;
create policy "departments_select" on departments for select using (true);

-- 2) New sign-ups may only ever create a plain, active STAFF profile
--    (stops someone registering themselves as super_admin).
drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  with check (id = auth.uid() and role = 'staff' and is_active = true);

-- 3) Users can edit their own profile but can't change their role or reactivate
--    themselves. (Also fixes a "infinite recursion" error the first version could cause.)
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid()
              and role = public.current_role()
              and is_active = public.is_active_user());
