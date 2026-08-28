begin;

select no_plan();

select public.sync_avatar_catalog(
  jsonb_build_array(
    jsonb_build_object(
      'id', 'test-aaaaaaaaaaaaaaaaaaaa',
      'generatorId', 'test',
      'preset', 'synthetic',
      'assetPath', '/avatars/test-aaaaaaaaaaaaaaaaaaaa.svg',
      'assetExtension', 'svg',
      'mediaType', 'image/svg+xml',
      'width', 128,
      'height', 128,
      'alt', 'Synthetic smiling avatar',
      'tags', jsonb_build_array('expression:smile'),
      'rightsId', 'cc0-test',
      'provenanceId', 'test-a',
      'assetSha256', repeat('a', 64)
    ),
    jsonb_build_object(
      'id', 'test-bbbbbbbbbbbbbbbbbbbb',
      'generatorId', 'test',
      'preset', 'synthetic',
      'assetPath', '/avatars/test-bbbbbbbbbbbbbbbbbbbb.png',
      'assetExtension', 'png',
      'mediaType', 'image/png',
      'width', 128,
      'height', 128,
      'alt', 'Synthetic avatar with glasses',
      'tags', jsonb_build_array('accessory:glasses'),
      'rightsId', 'cc0-test',
      'provenanceId', 'test-b',
      'assetSha256', repeat('b', 64)
    )
  ),
  '[]'::jsonb
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'user-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'user-b@example.test');

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'auth inserts create minimal profiles without copying metadata'
);

set local role anon;
select is((select count(*) from public.avatars), 2::bigint, 'anonymous users can read catalog identity');
select throws_ok(
  'select count(*) from public.profiles',
  '42501',
  'permission denied for table profiles',
  'anonymous users cannot read profiles'
);
select throws_ok(
  $$select public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', true)$$,
  '42501',
  'permission denied for function set_favorite',
  'anonymous users cannot execute private mutation RPCs'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
set local role authenticated;

select is((select count(*) from public.profiles), 1::bigint, 'a user reads only their own profile');
select throws_ok(
  $$insert into public.favorites (user_id, avatar_id)
    values ('00000000-0000-4000-8000-00000000000a', 'test-aaaaaaaaaaaaaaaaaaaa')$$,
  '42501',
  'permission denied for table favorites',
  'direct same-owner favorite inserts are denied'
);
select ok(
  public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', true),
  'setting a valid active favorite succeeds'
);
select ok(
  public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', true),
  'setting the same favorite twice is idempotent'
);
select is((select count(*) from public.favorites), 1::bigint, 'duplicate favorite writes store one row');
select throws_ok(
  $$select public.set_favorite('test-cccccccccccccccccccc', true)$$,
  'P0001',
  'VALIDATION_ERROR',
  'unknown avatar favorites fail validation'
);

select is(
  (public.create_agent_team('10000000-0000-4000-8000-000000000001', '  Alpha  ')).name,
  'Alpha',
  'team creation trims its name'
);
select is(
  (public.create_agent_team('10000000-0000-4000-8000-000000000001', 'Alpha')).id,
  '10000000-0000-4000-8000-000000000001'::uuid,
  'retrying one create intent returns the existing team'
);
select throws_ok(
  $$select public.create_agent_team('10000000-0000-4000-8000-000000000001', 'Different')$$,
  'P0001',
  'CONFLICT',
  'reusing a create intent with another payload fails generically'
);
select throws_ok(
  $$select public.create_agent_team('10000000-0000-4000-8000-000000000002', 'alpha')$$,
  'P0001',
  'CONFLICT',
  'team names are unique per owner without case sensitivity'
);
select is(
  (
    select count(*)
    from generate_series(2, 50) as team_number
    where (
      public.create_agent_team(
        ('20000000-0000-4000-8000-' || lpad(team_number::text, 12, '0'))::uuid,
        'Team ' || team_number
      )
    ).id is not null
  ),
  49::bigint,
  'one user can create up to fifty teams'
);
select throws_ok(
  $$select public.create_agent_team(
    '20000000-0000-4000-8000-000000000051',
    'Team 51'
  )$$,
  'P0001',
  'VALIDATION_ERROR',
  'the fifty-first team is rejected'
);

select results_eq(
  $$select avatar_id, position from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    array['test-bbbbbbbbbbbbbbbbbbbb', 'test-aaaaaaaaaaaaaaaaaaaa']
  )$$,
  $$values
    ('test-bbbbbbbbbbbbbbbbbbbb'::text, 0::smallint),
    ('test-aaaaaaaaaaaaaaaaaaaa'::text, 1::smallint)$$,
  'membership replacement persists exact array order'
);
select throws_ok(
  $$select * from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    array['test-aaaaaaaaaaaaaaaaaaaa', 'test-aaaaaaaaaaaaaaaaaaaa']
  )$$,
  'P0001',
  'VALIDATION_ERROR',
  'duplicate team members fail validation atomically'
);
select throws_ok(
  $$select * from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    array(select 'requested-' || value from generate_series(1, 101) as value)
  )$$,
  'P0001',
  'VALIDATION_ERROR',
  'a team cannot contain more than one hundred avatars'
);
select throws_ok(
  $$select * from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    null
  )$$,
  'P0001',
  'VALIDATION_ERROR',
  'null membership input is rejected'
);
select results_eq(
  $$select avatar_id, position from public.agent_team_avatars order by position$$,
  $$values
    ('test-bbbbbbbbbbbbbbbbbbbb'::text, 0::smallint),
    ('test-aaaaaaaaaaaaaaaaaaaa'::text, 1::smallint)$$,
  'a rejected replacement leaves the previous order intact'
);
select throws_ok(
  $$insert into public.agent_team_avatars (team_id, avatar_id, position)
    values (
      '10000000-0000-4000-8000-000000000001',
      'test-aaaaaaaaaaaaaaaaaaaa',
      2
    )$$,
  '42501',
  'permission denied for table agent_team_avatars',
  'direct same-owner membership writes are denied'
);
reset role;

select public.sync_avatar_catalog(
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object(
      'avatarId', 'test-aaaaaaaaaaaaaaaaaaaa',
      'code', 'rights',
      'effectiveAt', '2026-08-27T19:30:00Z',
      'reviewRef', 'review-1'
    )
  )
);
select is((select count(*) from public.avatars), 2::bigint, 'catalog omission never deletes identity rows');
select is(
  (select publication_status from public.avatars where id = 'test-aaaaaaaaaaaaaaaaaaaa'),
  'withdrawn',
  'explicit withdrawal creates a retained tombstone'
);
select throws_ok(
  $$select public.sync_avatar_catalog(
    jsonb_build_array(jsonb_build_object(
      'id', 'test-aaaaaaaaaaaaaaaaaaaa',
      'generatorId', 'test',
      'preset', 'synthetic',
      'assetPath', '/avatars/test-aaaaaaaaaaaaaaaaaaaa.svg',
      'assetExtension', 'svg',
      'mediaType', 'image/svg+xml',
      'width', 128,
      'height', 128,
      'alt', 'Republished',
      'tags', jsonb_build_array(),
      'rightsId', 'cc0-test',
      'provenanceId', 'test-a',
      'assetSha256', repeat('a', 64)
    )),
    '[]'::jsonb
  )$$,
  'P0001',
  'WITHDRAWN_ID_CANNOT_BE_REPUBLISHED',
  'withdrawn identity cannot be republished in v1'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'user B reads only their own profile');
select is((select count(*) from public.avatars), 2::bigint, 'user B retains public catalog access');
select is((select count(*) from public.favorites), 0::bigint, 'user B cannot read user A favorites');
select is((select count(*) from public.agent_teams), 0::bigint, 'user B cannot read user A teams');
select is((select count(*) from public.agent_team_avatars), 0::bigint, 'user B cannot read user A membership');
select throws_ok(
  $$select public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', true)$$,
  'P0001',
  'VALIDATION_ERROR',
  'new favorites cannot target withdrawn avatars'
);
select throws_ok(
  $$select public.rename_agent_team('10000000-0000-4000-8000-000000000001', 'Stolen')$$,
  'P0001',
  'NOT_FOUND',
  'cross-owner rename is indistinguishable from a missing team'
);
select throws_ok(
  $$select public.rename_agent_team('90000000-0000-4000-8000-000000000001', 'Missing')$$,
  'P0001',
  'NOT_FOUND',
  'missing and cross-owner rename return the same error'
);
select throws_ok(
  $$select public.create_agent_team('10000000-0000-4000-8000-000000000001', 'Collision')$$,
  'P0001',
  'CONFLICT',
  'a cross-owner create-intent collision leaks no owner details'
);
select throws_ok(
  $$select * from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    array['test-bbbbbbbbbbbbbbbbbbbb']
  )$$,
  'P0001',
  'NOT_FOUND',
  'cross-owner membership is indistinguishable from a missing team'
);
select throws_ok(
  $$select * from public.set_agent_team_members(
    '90000000-0000-4000-8000-000000000001',
    array['test-bbbbbbbbbbbbbbbbbbbb']
  )$$,
  'P0001',
  'NOT_FOUND',
  'missing and cross-owner membership return the same error'
);
select ok(
  public.delete_agent_team('10000000-0000-4000-8000-000000000001'),
  'cross-owner delete has the same idempotent result as missing'
);
select ok(
  public.delete_agent_team('90000000-0000-4000-8000-000000000001'),
  'missing and cross-owner delete return the same result'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
set local role authenticated;
select results_eq(
  $$select avatar_id, position from public.set_agent_team_members(
    '10000000-0000-4000-8000-000000000001',
    array['test-aaaaaaaaaaaaaaaaaaaa', 'test-bbbbbbbbbbbbbbbbbbbb']
  )$$,
  $$values
    ('test-aaaaaaaaaaaaaaaaaaaa'::text, 0::smallint),
    ('test-bbbbbbbbbbbbbbbbbbbb'::text, 1::smallint)$$,
  'an owner can retain and reorder a withdrawn avatar already in that team'
);
select is(
  public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', false),
  false,
  'a withdrawn favorite can still be removed'
);
select is(
  public.set_favorite('test-aaaaaaaaaaaaaaaaaaaa', false),
  false,
  'favorite removal is idempotent'
);
reset role;

select throws_ok(
  $$insert into public.favorites (user_id, avatar_id)
    values ('00000000-0000-4000-8000-00000000000a', 'test-cccccccccccccccccccc')$$,
  '23503',
  null,
  'foreign keys reject invalid avatar references even for privileged writes'
);

select ok(
  not has_table_privilege('authenticated', 'public.favorites', 'insert')
  and not has_table_privilege('authenticated', 'public.agent_teams', 'update')
  and not has_table_privilege('authenticated', 'public.agent_team_avatars', 'delete'),
  'authenticated users have no direct private-table write grants'
);
select ok(
  not exists (
    select 1
    from (
      values
        ('anon', 'profiles', false),
        ('anon', 'avatars', true),
        ('anon', 'favorites', false),
        ('anon', 'agent_teams', false),
        ('anon', 'agent_team_avatars', false),
        ('authenticated', 'profiles', true),
        ('authenticated', 'avatars', true),
        ('authenticated', 'favorites', true),
        ('authenticated', 'agent_teams', true),
        ('authenticated', 'agent_team_avatars', true)
    ) as expected(role_name, table_name, can_select)
    cross join (
      values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
    ) as operation(privilege_name)
    where pg_catalog.has_table_privilege(
      expected.role_name,
      pg_catalog.format('public.%I', expected.table_name),
      operation.privilege_name
    ) <> (operation.privilege_name = 'SELECT' and expected.can_select)
  ),
  'anon and authenticated table grants match the complete read-only matrix'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'profiles',
        'avatars',
        'favorites',
        'agent_teams',
        'agent_team_avatars'
      )
      and pg_class.relrowsecurity
  ),
  5::bigint,
  'RLS is enabled on every exposed application table'
);
select ok(
  not has_function_privilege('anon', 'public.set_favorite(text, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.set_favorite(text, boolean)', 'execute'),
  'mutation RPC execute grants are exact'
);
select ok(
  (
    select pg_catalog.pg_get_userbyid(proowner) = 'app_private_writer'
      and prosecdef
      and proconfig = array['search_path=""']
    from pg_catalog.pg_proc
    where oid = 'public.set_favorite(text, boolean)'::regprocedure
  ),
  'mutation RPC uses the constrained definer and an empty search path'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'set_favorite',
        'create_agent_team',
        'rename_agent_team',
        'delete_agent_team',
        'set_agent_team_members'
      )
      and pg_catalog.pg_get_userbyid(pg_proc.proowner) = 'app_private_writer'
      and pg_proc.prosecdef
      and pg_proc.proconfig = array['search_path=""']
  ),
  5::bigint,
  'all private mutation RPCs use the constrained definer role'
);
select ok(
  not exists (
    select 1
    from (
      values
        ('profiles', 'profiles_select_own', 'SELECT', array['authenticated']::name[]),
        ('profiles', 'profiles_writer_select_own', 'SELECT', array['app_private_writer']::name[]),
        ('avatars', 'avatars_select_public', 'SELECT', array['anon', 'authenticated']::name[]),
        ('avatars', 'avatars_writer_select', 'SELECT', array['app_private_writer']::name[]),
        ('favorites', 'favorites_select_own', 'SELECT', array['authenticated']::name[]),
        ('favorites', 'favorites_writer_select_own', 'SELECT', array['app_private_writer']::name[]),
        ('favorites', 'favorites_writer_insert_own', 'INSERT', array['app_private_writer']::name[]),
        ('favorites', 'favorites_writer_delete_own', 'DELETE', array['app_private_writer']::name[]),
        ('agent_teams', 'agent_teams_select_own', 'SELECT', array['authenticated']::name[]),
        ('agent_teams', 'agent_teams_writer_select_own', 'SELECT', array['app_private_writer']::name[]),
        ('agent_teams', 'agent_teams_writer_insert_own', 'INSERT', array['app_private_writer']::name[]),
        ('agent_teams', 'agent_teams_writer_update_own', 'UPDATE', array['app_private_writer']::name[]),
        ('agent_teams', 'agent_teams_writer_delete_own', 'DELETE', array['app_private_writer']::name[]),
        ('agent_team_avatars', 'agent_team_avatars_select_own', 'SELECT', array['authenticated']::name[]),
        ('agent_team_avatars', 'agent_team_avatars_writer_select_own', 'SELECT', array['app_private_writer']::name[]),
        ('agent_team_avatars', 'agent_team_avatars_writer_insert_own', 'INSERT', array['app_private_writer']::name[]),
        ('agent_team_avatars', 'agent_team_avatars_writer_delete_own', 'DELETE', array['app_private_writer']::name[])
    ) as expected(table_name, policy_name, command_name, role_names)
    full join (
      select *
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in ('profiles', 'avatars', 'favorites', 'agent_teams', 'agent_team_avatars')
    ) actual
      on actual.tablename = expected.table_name
      and actual.policyname = expected.policy_name
      and actual.cmd = expected.command_name
      and actual.roles = expected.role_names
    where expected.policy_name is null or actual.policyname is null
  ),
  'the exposed tables have exactly the reviewed policy commands and roles'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in ('profiles', 'avatars', 'favorites', 'agent_teams', 'agent_team_avatars')
      and pg_catalog.pg_get_userbyid(pg_class.relowner) = 'postgres'
  ),
  5::bigint,
  'all exposed tables remain owned by the non-writer migration role'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname in (
        'is_sorted_unique_text_array',
        'set_updated_at',
        'current_user_id',
        'create_profile_for_auth_user'
      )
      and pg_catalog.pg_get_userbyid(pg_proc.proowner) = 'postgres'
      and pg_proc.proconfig = array['search_path=""']
  ),
  4::bigint,
  'all private helpers retain the non-writer owner and empty search path'
);
select ok(
  (
    select pg_catalog.pg_get_userbyid(proowner) = 'postgres'
      and prosecdef
      and proconfig = array['search_path=""']
    from pg_catalog.pg_proc
    where oid = 'public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure
  ),
  'catalog synchronization retains its non-writer definer and empty search path'
);
select ok(
  not exists (
    select 1
    from (
      values
        ('public.set_favorite(text, boolean)'::regprocedure, true, false),
        ('public.create_agent_team(uuid, text)'::regprocedure, true, false),
        ('public.rename_agent_team(uuid, text)'::regprocedure, true, false),
        ('public.delete_agent_team(uuid)'::regprocedure, true, false),
        ('public.set_agent_team_members(uuid, text[])'::regprocedure, true, false),
        ('public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, false, true)
    ) as expected(function_oid, authenticated_execute, service_execute)
    where pg_catalog.has_function_privilege('anon', expected.function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('public', expected.function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege(
        'authenticated',
        expected.function_oid,
        'EXECUTE'
      ) <> expected.authenticated_execute
      or pg_catalog.has_function_privilege(
        'service_role',
        expected.function_oid,
        'EXECUTE'
      ) <> expected.service_execute
  ),
  'all exposed functions have exact anon, authenticated, public, and service grants'
);

delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is((select count(*) from public.agent_teams), 0::bigint, 'account deletion cascades teams');
select is((select count(*) from public.favorites), 0::bigint, 'account deletion cascades favorites');

select * from finish();
rollback;
