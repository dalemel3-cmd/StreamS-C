-- Web remote for HPD TV (/remote). A tiny command queue + one status row, both in tv_private
-- (not HPD tables). The Vercel server is the only caller; every function checks the same
-- hashed token as tv_board. Commands older than 2 minutes are never delivered and rows older
-- than a day are pruned, so the queue stays a few rows long.

create table if not exists tv_private.remote_commands (
  id bigserial primary key,
  cmd jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists tv_private.remote_state (
  id int primary key default 1 check (id = 1),
  tv_status jsonb,
  tv_seen_at timestamptz,
  remote_seen_at timestamptz
);
insert into tv_private.remote_state (id) values (1) on conflict do nothing;

revoke all on tv_private.remote_commands, tv_private.remote_state from public, anon, authenticated;

create or replace function tv_private.remote_authorized(p_token text)
 returns boolean
 language sql stable security definer
 set search_path to 'tv_private', 'pg_temp'
as $$
  select p_token is not null and exists (
    select 1 from tv_private.access
    where token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  );
$$;
revoke all on function tv_private.remote_authorized(text) from public, anon, authenticated;

-- Remote -> queue one command. Returns its id.
create or replace function public.tv_remote_send(p_token text, p_cmd jsonb)
 returns bigint
 language plpgsql volatile security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  new_id bigint;
begin
  if not tv_private.remote_authorized(p_token) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_cmd is null or jsonb_typeof(p_cmd) <> 'object' or length(p_cmd::text) > 2000 then
    raise exception 'bad command' using errcode = '22023';
  end if;
  insert into tv_private.remote_commands (cmd) values (p_cmd) returning id into new_id;
  delete from tv_private.remote_commands where created_at < now() - interval '1 day';
  update tv_private.remote_state set remote_seen_at = now() where id = 1;
  return new_id;
end;
$$;

-- Remote page -> what the TV last reported. Also tells the TV to poll fast for 10 minutes.
create or replace function public.tv_remote_status(p_token text)
 returns jsonb
 language plpgsql volatile security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  s tv_private.remote_state;
begin
  if not tv_private.remote_authorized(p_token) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update tv_private.remote_state set remote_seen_at = now() where id = 1 returning * into s;
  return jsonb_build_object('tv', s.tv_status, 'tv_seen_at', s.tv_seen_at, 'now', now());
end;
$$;

-- TV -> report status, get commands newer than p_since (null = just give me the latest id).
create or replace function public.tv_remote_poll(p_token text, p_since bigint, p_status jsonb)
 returns jsonb
 language plpgsql volatile security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  last_id bigint;
  r_seen timestamptz;
  cmds jsonb;
begin
  if not tv_private.remote_authorized(p_token) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update tv_private.remote_state
     set tv_status = case when p_status is not null and length(p_status::text) <= 8000
                          then p_status else tv_status end,
         tv_seen_at = now()
   where id = 1
   returning remote_seen_at into r_seen;
  select coalesce(max(id), 0) into last_id from tv_private.remote_commands;
  if p_since is null or p_since > last_id then
    cmds := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cmd', cmd) order by id), '[]'::jsonb)
      into cmds
      from tv_private.remote_commands
     where id > p_since and created_at > now() - interval '2 minutes';
  end if;
  return jsonb_build_object(
    'last', last_id,
    'commands', cmds,
    'fast', coalesce(r_seen > now() - interval '10 minutes', false)
  );
end;
$$;

revoke all on function public.tv_remote_send(text, jsonb) from public;
revoke all on function public.tv_remote_status(text) from public;
revoke all on function public.tv_remote_poll(text, bigint, jsonb) from public;
grant execute on function public.tv_remote_send(text, jsonb) to anon, service_role;
grant execute on function public.tv_remote_status(text) to anon, service_role;
grant execute on function public.tv_remote_poll(text, bigint, jsonb) to anon, service_role;
