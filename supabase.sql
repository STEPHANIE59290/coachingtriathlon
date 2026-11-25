-- Mon Coach Half : base de données des comptes (à exécuter UNE fois dans Supabase > SQL Editor)

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        integer     not null default 1,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque utilisateur ne voit et ne modifie que SA ligne.
alter table public.app_state enable row level security;

drop policy if exists "app_state_select_own" on public.app_state;
drop policy if exists "app_state_insert_own" on public.app_state;
drop policy if exists "app_state_update_own" on public.app_state;
drop policy if exists "app_state_delete_own" on public.app_state;

create policy "app_state_select_own" on public.app_state for select to authenticated using (auth.uid() = user_id);
create policy "app_state_insert_own" on public.app_state for insert to authenticated with check (auth.uid() = user_id);
create policy "app_state_update_own" on public.app_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "app_state_delete_own" on public.app_state for delete to authenticated using (auth.uid() = user_id);

revoke all on public.app_state from anon;
grant select, insert, update, delete on public.app_state to authenticated;

-- Suppression de compte demandée par l'utilisateur (bouton « Supprimer mon compte »).
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
