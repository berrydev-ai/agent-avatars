create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'app_private_writer'
  ) then
    create role app_private_writer nologin nobypassrls;
  end if;
end
$$;

alter role app_private_writer nologin nobypassrls;
grant app_private_writer to postgres;
grant usage, create on schema public to app_private_writer;

create function private.is_sorted_unique_text_array(p_values text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_values = array(
      select distinct value
      from pg_catalog.unnest(p_values) as value
      order by value
    ),
    false
  )
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
$$;

revoke execute on function private.current_user_id() from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.avatars (
  id text primary key,
  generator_id text not null,
  preset text not null,
  asset_path text not null unique,
  asset_extension text not null,
  media_type text not null,
  width integer not null,
  height integer not null,
  alt text not null,
  tags text[] not null default '{}',
  rights_id text not null,
  provenance_id text not null,
  asset_sha256 text not null,
  manifest_version integer not null default 1,
  publication_status text not null default 'active',
  withdrawn_at timestamptz,
  withdrawal_code text,
  withdrawal_ref text,
  constraint avatars_id_format check (
    id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{20}$'
    and id like generator_id || '-%'
  ),
  constraint avatars_generator_id_format check (
    generator_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint avatars_preset_not_blank check (preset = pg_catalog.btrim(preset) and preset <> ''),
  constraint avatars_asset_extension_allowed check (asset_extension in ('svg', 'png', 'webp', 'avif')),
  constraint avatars_media_type_allowed check (
    (asset_extension = 'svg' and media_type = 'image/svg+xml')
    or (asset_extension = 'png' and media_type = 'image/png')
    or (asset_extension = 'webp' and media_type = 'image/webp')
    or (asset_extension = 'avif' and media_type = 'image/avif')
  ),
  constraint avatars_asset_path_canonical check (
    asset_path = '/avatars/' || id || '.' || asset_extension
  ),
  constraint avatars_square_dimensions check (width > 0 and width = height),
  constraint avatars_alt_not_blank check (alt = pg_catalog.btrim(alt) and alt <> ''),
  constraint avatars_tags_sorted_unique check (private.is_sorted_unique_text_array(tags)),
  constraint avatars_rights_not_blank check (rights_id = pg_catalog.btrim(rights_id) and rights_id <> ''),
  constraint avatars_provenance_not_blank check (
    provenance_id = pg_catalog.btrim(provenance_id) and provenance_id <> ''
  ),
  constraint avatars_sha256_format check (asset_sha256 ~ '^[0-9a-f]{64}$'),
  constraint avatars_manifest_version check (manifest_version = 1),
  constraint avatars_publication_status check (publication_status in ('active', 'withdrawn')),
  constraint avatars_withdrawal_state check (
    (
      publication_status = 'active'
      and withdrawn_at is null
      and withdrawal_code is null
      and withdrawal_ref is null
    )
    or (
      publication_status = 'withdrawn'
      and withdrawn_at is not null
      and withdrawal_code in ('rights', 'safety', 'privacy', 'provider', 'takedown', 'other')
      and withdrawal_ref = pg_catalog.btrim(withdrawal_ref)
      and withdrawal_ref <> ''
      and alt = 'Avatar unavailable'
      and tags = '{}'
    )
  )
);

create table public.favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  avatar_id text not null references public.avatars(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, avatar_id)
);

create table public.agent_teams (
  id uuid primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint agent_teams_name_valid check (
    name = pg_catalog.btrim(name)
    and pg_catalog.char_length(name) between 1 and 80
  )
);

create unique index agent_teams_user_name_unique
on public.agent_teams (user_id, pg_catalog.lower(name));

create table public.agent_team_avatars (
  team_id uuid not null references public.agent_teams(id) on delete cascade,
  avatar_id text not null references public.avatars(id) on delete restrict,
  position smallint not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (team_id, avatar_id),
  unique (team_id, position),
  constraint agent_team_avatars_position_valid check (position between 0 and 99)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger agent_teams_set_updated_at
before update on public.agent_teams
for each row execute function private.set_updated_at();

create function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end
$$;

revoke execute on function private.create_profile_for_auth_user() from public;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function private.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.avatars enable row level security;
alter table public.favorites enable row level security;
alter table public.agent_teams enable row level security;
alter table public.agent_team_avatars enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.avatars from anon, authenticated;
revoke all on table public.favorites from anon, authenticated;
revoke all on table public.agent_teams from anon, authenticated;
revoke all on table public.agent_team_avatars from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.avatars to anon, authenticated;
grant select on table public.favorites to authenticated;
grant select on table public.agent_teams to authenticated;
grant select on table public.agent_team_avatars to authenticated;

grant select on table public.profiles, public.avatars to app_private_writer;
grant select, insert, delete on table public.favorites to app_private_writer;
grant select, insert, delete on table public.agent_teams to app_private_writer;
grant update (name) on table public.agent_teams to app_private_writer;
grant select, insert, delete on table public.agent_team_avatars to app_private_writer;
grant usage on schema private to app_private_writer;
grant execute on function private.current_user_id() to app_private_writer;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy profiles_writer_select_own
on public.profiles for select to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy avatars_select_public
on public.avatars for select to anon, authenticated
using (true);

create policy avatars_writer_select
on public.avatars for select to app_private_writer
using (true);

create policy favorites_select_own
on public.favorites for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy favorites_writer_select_own
on public.favorites for select to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy favorites_writer_insert_own
on public.favorites for insert to app_private_writer
with check (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy favorites_writer_delete_own
on public.favorites for delete to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy agent_teams_select_own
on public.agent_teams for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy agent_teams_writer_select_own
on public.agent_teams for select to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy agent_teams_writer_insert_own
on public.agent_teams for insert to app_private_writer
with check (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy agent_teams_writer_update_own
on public.agent_teams for update to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
)
with check (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy agent_teams_writer_delete_own
on public.agent_teams for delete to app_private_writer
using (
  (select private.current_user_id()) is not null
  and (select private.current_user_id()) = user_id
);

create policy agent_team_avatars_select_own
on public.agent_team_avatars for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.agent_teams
    where agent_teams.id = agent_team_avatars.team_id
      and agent_teams.user_id = (select auth.uid())
  )
);

create policy agent_team_avatars_writer_select_own
on public.agent_team_avatars for select to app_private_writer
using (
  (select private.current_user_id()) is not null
  and exists (
    select 1
    from public.agent_teams
    where agent_teams.id = agent_team_avatars.team_id
      and agent_teams.user_id = (select private.current_user_id())
  )
);

create policy agent_team_avatars_writer_insert_own
on public.agent_team_avatars for insert to app_private_writer
with check (
  (select private.current_user_id()) is not null
  and exists (
    select 1
    from public.agent_teams
    where agent_teams.id = agent_team_avatars.team_id
      and agent_teams.user_id = (select private.current_user_id())
  )
);

create policy agent_team_avatars_writer_delete_own
on public.agent_team_avatars for delete to app_private_writer
using (
  (select private.current_user_id()) is not null
  and exists (
    select 1
    from public.agent_teams
    where agent_teams.id = agent_team_avatars.team_id
      and agent_teams.user_id = (select private.current_user_id())
  )
);

create function public.set_favorite(p_avatar_id text, p_is_favorite boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_avatar_id is null or p_is_favorite is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if p_is_favorite then
    if not exists (
      select 1 from public.avatars
      where id = p_avatar_id and publication_status = 'active'
    ) then
      raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
    end if;

    insert into public.favorites (user_id, avatar_id)
    values (v_user_id, p_avatar_id)
    on conflict (user_id, avatar_id) do nothing;
  else
    delete from public.favorites
    where user_id = v_user_id and avatar_id = p_avatar_id;
  end if;

  return exists (
    select 1 from public.favorites
    where user_id = v_user_id and avatar_id = p_avatar_id
  );
end
$$;

create function public.create_agent_team(p_id uuid, p_name text)
returns public.agent_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_name text := pg_catalog.btrim(p_name);
  v_team public.agent_teams%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_id is null or v_name is null or pg_catalog.char_length(v_name) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select * into v_team
  from public.agent_teams
  where id = p_id;

  if found then
    if v_team.name = v_name then
      return v_team;
    end if;
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  if (select pg_catalog.count(*) from public.agent_teams) >= 50 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  begin
    insert into public.agent_teams (id, user_id, name)
    values (p_id, v_user_id, v_name)
    returning * into v_team;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end;

  return v_team;
end
$$;

create function public.rename_agent_team(p_team_id uuid, p_name text)
returns public.agent_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_name text := pg_catalog.btrim(p_name);
  v_team public.agent_teams%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_team_id is null or v_name is null or pg_catalog.char_length(v_name) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  begin
    update public.agent_teams
    set name = v_name
    where id = p_team_id
    returning * into v_team;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  return v_team;
end
$$;

create function public.delete_agent_team(p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_team_id is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  delete from public.agent_teams where id = p_team_id;
  return true;
end
$$;

create function public.set_agent_team_members(p_team_id uuid, p_avatar_ids text[])
returns table (avatar_id text, "position" smallint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_team_id is null or p_avatar_ids is null or pg_catalog.cardinality(p_avatar_ids) > 100 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if exists (select 1 from pg_catalog.unnest(p_avatar_ids) as value where value is null)
    or pg_catalog.cardinality(p_avatar_ids) <> (
      select pg_catalog.count(distinct value) from pg_catalog.unnest(p_avatar_ids) as value
    ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  perform 1
  from public.agent_teams
  where id = p_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_avatar_ids) as requested(id)
    left join public.avatars on avatars.id = requested.id
    where avatars.id is null
      or (
        avatars.publication_status <> 'active'
        and not exists (
          select 1 from public.agent_team_avatars existing
          where existing.team_id = p_team_id and existing.avatar_id = requested.id
        )
      )
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  delete from public.agent_team_avatars where team_id = p_team_id;

  insert into public.agent_team_avatars (team_id, avatar_id, position)
  select p_team_id, requested.id, (requested.ordinality - 1)::smallint
  from pg_catalog.unnest(p_avatar_ids) with ordinality as requested(id, ordinality);

  return query
  select stored.avatar_id, stored.position
  from public.agent_team_avatars stored
  where stored.team_id = p_team_id
  order by stored.position;
end
$$;

alter function public.set_favorite(text, boolean) owner to app_private_writer;
alter function public.create_agent_team(uuid, text) owner to app_private_writer;
alter function public.rename_agent_team(uuid, text) owner to app_private_writer;
alter function public.delete_agent_team(uuid) owner to app_private_writer;
alter function public.set_agent_team_members(uuid, text[]) owner to app_private_writer;
revoke create on schema public from app_private_writer;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role app_private_writer in schema public revoke execute on functions from public;

grant execute on function public.set_favorite(text, boolean) to authenticated;
grant execute on function public.create_agent_team(uuid, text) to authenticated;
grant execute on function public.rename_agent_team(uuid, text) to authenticated;
grant execute on function public.delete_agent_team(uuid) to authenticated;
grant execute on function public.set_agent_team_members(uuid, text[]) to authenticated;

create function public.sync_avatar_catalog(p_active jsonb, p_withdrawals jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_active) <> 'array'
    or pg_catalog.jsonb_typeof(p_withdrawals) <> 'array' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_ERROR';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_active) as record(id text)
    join public.avatars on avatars.id = record.id
    where avatars.publication_status = 'withdrawn'
  ) then
    raise exception using errcode = 'P0001', message = 'WITHDRAWN_ID_CANNOT_BE_REPUBLISHED';
  end if;

  insert into public.avatars (
    id,
    generator_id,
    preset,
    asset_path,
    asset_extension,
    media_type,
    width,
    height,
    alt,
    tags,
    rights_id,
    provenance_id,
    asset_sha256,
    manifest_version,
    publication_status,
    withdrawn_at,
    withdrawal_code,
    withdrawal_ref
  )
  select
    record.id,
    record."generatorId",
    record.preset,
    record."assetPath",
    record."assetExtension",
    record."mediaType",
    record.width,
    record.height,
    record.alt,
    record.tags,
    record."rightsId",
    record."provenanceId",
    record."assetSha256",
    1,
    'active',
    null,
    null,
    null
  from pg_catalog.jsonb_to_recordset(p_active) as record(
    id text,
    "generatorId" text,
    preset text,
    "assetPath" text,
    "assetExtension" text,
    "mediaType" text,
    width integer,
    height integer,
    alt text,
    tags text[],
    "rightsId" text,
    "provenanceId" text,
    "assetSha256" text
  )
  on conflict (id) do update set
    generator_id = excluded.generator_id,
    preset = excluded.preset,
    asset_path = excluded.asset_path,
    asset_extension = excluded.asset_extension,
    media_type = excluded.media_type,
    width = excluded.width,
    height = excluded.height,
    alt = excluded.alt,
    tags = excluded.tags,
    rights_id = excluded.rights_id,
    provenance_id = excluded.provenance_id,
    asset_sha256 = excluded.asset_sha256,
    manifest_version = excluded.manifest_version;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_withdrawals) as withdrawal("avatarId" text)
    left join public.avatars on avatars.id = withdrawal."avatarId"
    where avatars.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'UNKNOWN_WITHDRAWAL_ID';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_to_recordset(p_withdrawals) as withdrawal("avatarId" text)
  ) <> (
    select pg_catalog.count(distinct withdrawal."avatarId")
    from pg_catalog.jsonb_to_recordset(p_withdrawals) as withdrawal("avatarId" text)
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_WITHDRAWAL_ID';
  end if;

  update public.avatars
  set
    publication_status = 'withdrawn',
    withdrawn_at = withdrawal."effectiveAt",
    withdrawal_code = withdrawal.code,
    withdrawal_ref = withdrawal."reviewRef",
    alt = 'Avatar unavailable',
    tags = '{}'
  from pg_catalog.jsonb_to_recordset(p_withdrawals) as withdrawal(
    "avatarId" text,
    code text,
    "effectiveAt" timestamptz,
    "reviewRef" text
  )
  where avatars.id = withdrawal."avatarId";
end
$$;

revoke execute on function public.sync_avatar_catalog(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_avatar_catalog(jsonb, jsonb) to service_role;
