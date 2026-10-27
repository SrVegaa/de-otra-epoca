drop policy if exists postcards_authenticated_read_approved on public.postcards;
drop policy if exists postcards_admin_read_all on public.postcards;
create policy postcards_authenticated_read on public.postcards
  for select to authenticated
  using (
    (status = 'approved' and published_at is not null)
    or (select auth.uid()) = 'f5de4699-d26e-4b10-9c75-fea1dcb44c52'::uuid
  );

drop policy if exists postcard_reactions_deny_clients on public.postcard_reactions;
create policy postcard_reactions_deny_clients on public.postcard_reactions
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists postcard_rate_limits_deny_clients on public.postcard_rate_limits;
create policy postcard_rate_limits_deny_clients on public.postcard_rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);

create index if not exists postcards_published_at_idx
  on public.postcards (published_at desc)
  where status = 'approved' and published_at is not null;

create index if not exists postcards_created_at_idx
  on public.postcards (created_at desc);
