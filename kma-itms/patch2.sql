-- ============================================================
-- PATCH 2 — Users page. Run once in Supabase → SQL Editor → New query → Run
--
-- Why: the browser can't create a SEPARATE account for someone else while
-- you're signed in as yourself (Supabase's signUp() would hijack your own
-- session into the new one). So instead of the Super Admin typing a password
-- for the new IT Admin, they "invite" the email — the person then registers
-- themselves as normal, and this promotes them to it_admin automatically.
-- ============================================================

create table if not exists pending_admins (
  email text primary key,
  staff_id text not null,
  full_name text not null,
  department_id int references departments(id) on delete set null,
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table pending_admins enable row level security;

-- Super Admin manages invites
drop policy if exists "pending_admins_admin_all" on pending_admins;
create policy "pending_admins_admin_all" on pending_admins for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Anyone can check whether THEIR OWN email has a pending invite —
-- needed the moment they register, before they have any role at all.
drop policy if exists "pending_admins_self_check" on pending_admins;
create policy "pending_admins_self_check" on pending_admins for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- A new sign-up may set role='it_admin' ONLY if their email has a pending
-- invite; otherwise (as before) they can only ever register as plain staff.
drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  with check (
    id = auth.uid() and is_active = true
    and (
      role = 'staff'
      or (role = 'it_admin' and exists (select 1 from pending_admins p where lower(p.email) = lower(email)))
    )
  );

-- Once that profile is created, the invite is used up — delete it automatically
-- (security definer so it isn't blocked by the invitee's own limited RLS access).
create or replace function public.consume_pending_admin()
returns trigger language plpgsql security definer as $$
begin
  delete from pending_admins where lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists profiles_consume_pending_admin on profiles;
create trigger profiles_consume_pending_admin
  after insert on profiles
  for each row execute function public.consume_pending_admin();
