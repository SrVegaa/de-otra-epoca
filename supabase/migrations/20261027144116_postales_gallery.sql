create table if not exists public.postcards (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 200),
  approximate_year smallint check (approximate_year is null or approximate_year between 1900 and 2100),
  display_name text not null check (char_length(display_name) between 1 and 60),
  image_path text not null,
  published_image_path text,
  consent boolean not null default false check (consent is true),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reaction_count integer not null default 0 check (reaction_count >= 0),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  constraint postcards_publication_consistency check (
    (status = 'approved' and published_at is not null and published_image_path is not null)
    or status <> 'approved'
  )
);

alter table public.postcards enable row level security;
revoke all on public.postcards from anon, authenticated;
grant select on public.postcards to anon, authenticated;
grant update, delete on public.postcards to authenticated;
grant all privileges on public.postcards to service_role;

drop policy if exists postcards_public_read_approved on public.postcards;
create policy postcards_public_read_approved on public.postcards
  for select to anon
  using (status = 'approved' and published_at is not null);

drop policy if exists postcards_authenticated_read_approved on public.postcards;
create policy postcards_authenticated_read_approved on public.postcards
  for select to authenticated
  using (status = 'approved' and published_at is not null);

drop policy if exists postcards_admin_read_all on public.postcards;
create policy postcards_admin_read_all on public.postcards
  for select to authenticated
  using ((select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid);

drop policy if exists postcards_admin_update on public.postcards;
create policy postcards_admin_update on public.postcards
  for update to authenticated
  using ((select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid)
  with check ((select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid);

drop policy if exists postcards_admin_delete on public.postcards;
create policy postcards_admin_delete on public.postcards
  for delete to authenticated
  using ((select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid);

create table if not exists public.postcard_reactions (
  postcard_id uuid not null references public.postcards(id) on delete cascade,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (postcard_id, visitor_hash)
);
alter table public.postcard_reactions enable row level security;
revoke all on public.postcard_reactions from anon, authenticated;
grant select, insert, delete on public.postcard_reactions to service_role;

create table if not exists public.postcard_rate_limits (
  bucket_key text not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (bucket_key, action)
);
alter table public.postcard_rate_limits enable row level security;
revoke all on public.postcard_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.postcard_rate_limits to service_role;

create or replace function public.update_postcard_reaction_count()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.postcards set reaction_count = reaction_count + 1 where id = new.postcard_id;
    return new;
  end if;
  update public.postcards set reaction_count = greatest(0, reaction_count - 1) where id = old.postcard_id;
  return old;
end;
$$;

drop trigger if exists postcard_reaction_count_trigger on public.postcard_reactions;
create trigger postcard_reaction_count_trigger
  after insert or delete on public.postcard_reactions
  for each row execute function public.update_postcard_reaction_count();

create or replace function public.consume_postcard_rate_limit(
  p_bucket_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.postcard_rate_limits (bucket_key, action, window_started_at, request_count)
  values (p_bucket_key, p_action, now(), 1)
  on conflict (bucket_key, action) do update
    set request_count = case
          when postcard_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1
          else postcard_rate_limits.request_count + 1
        end,
        window_started_at = case
          when postcard_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then now()
          else postcard_rate_limits.window_started_at
        end
  returning request_count into v_count;
  return v_count <= p_max_requests;
end;
$$;

create or replace function public.toggle_postcard_reaction(p_postcard_id uuid, p_visitor_hash text)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_found uuid;
begin
  perform 1 from public.postcards where id = p_postcard_id and status = 'approved' and published_at is not null for update;
  if not found then
    raise exception 'Postal no disponible';
  end if;
  delete from public.postcard_reactions
    where postcard_id = p_postcard_id and visitor_hash = p_visitor_hash
    returning postcard_id into v_found;
  if found then return false; end if;
  insert into public.postcard_reactions(postcard_id, visitor_hash)
    values (p_postcard_id, p_visitor_hash)
    on conflict (postcard_id, visitor_hash) do nothing;
  return true;
end;
$$;

create or replace function public.postcard_reaction_states(p_postcard_ids uuid[], p_visitor_hash text)
returns table(postcard_id uuid)
language sql
stable
set search_path = public, pg_temp
as $$
  select r.postcard_id
  from public.postcard_reactions r
  join public.postcards p on p.id = r.postcard_id
  where r.postcard_id = any(p_postcard_ids)
    and r.visitor_hash = p_visitor_hash
    and p.status = 'approved'
    and p.published_at is not null;
$$;

revoke all on function public.consume_postcard_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.toggle_postcard_reaction(uuid, text) from public, anon, authenticated;
revoke all on function public.postcard_reaction_states(uuid[], text) from public, anon, authenticated;
grant execute on function public.consume_postcard_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.toggle_postcard_reaction(uuid, text) to service_role;
grant execute on function public.postcard_reaction_states(uuid[], text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postcards-pending', 'postcards-pending', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postcards-published', 'postcards-published', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists postcards_admin_read_pending_storage on storage.objects;
create policy postcards_admin_read_pending_storage on storage.objects
  for select to authenticated
  using (bucket_id = 'postcards-pending' and (select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid);

drop policy if exists postcards_admin_read_published_storage on storage.objects;
create policy postcards_admin_read_published_storage on storage.objects
  for select to authenticated
  using (bucket_id = 'postcards-published' and (select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid);
