begin;

select no_plan();

select ok(
  exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'app_private_writer'
      and not rolsuper
      and rolinherit
      and not rolcreaterole
      and not rolcreatedb
      and not rolcanlogin
      and not rolreplication
      and not rolbypassrls
  ),
  'the private writer retains its exact constrained role attributes'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('avatars'),
        ('favorites'),
        ('agent_teams'),
        ('agent_team_avatars')
    ) as expected(table_name)
    full join (
      select
        pg_class.relname as table_name,
        pg_catalog.pg_get_userbyid(pg_class.relowner) as owner_name,
        pg_class.relrowsecurity,
        pg_class.relforcerowsecurity
      from pg_catalog.pg_class
      join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind = 'r'
        and pg_class.relname in (
          'profiles',
          'avatars',
          'favorites',
          'agent_teams',
          'agent_team_avatars'
        )
    ) as actual using (table_name)
    where expected.table_name is null
      or actual.table_name is null
      or actual.owner_name <> 'postgres'
      or not actual.relrowsecurity
      or actual.relforcerowsecurity
  ),
  'every exposed table has the exact owner and RLS mode'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('profiles', 'service_role', 'MAINTAIN'),
        ('profiles', 'service_role', 'TRUNCATE'),
        ('profiles', 'service_role', 'REFERENCES'),
        ('profiles', 'service_role', 'TRIGGER'),
        ('profiles', 'authenticated', 'SELECT'),
        ('profiles', 'app_private_writer', 'SELECT'),
        ('avatars', 'service_role', 'MAINTAIN'),
        ('avatars', 'service_role', 'TRUNCATE'),
        ('avatars', 'service_role', 'REFERENCES'),
        ('avatars', 'service_role', 'TRIGGER'),
        ('avatars', 'anon', 'SELECT'),
        ('avatars', 'authenticated', 'SELECT'),
        ('avatars', 'app_private_writer', 'SELECT'),
        ('favorites', 'service_role', 'MAINTAIN'),
        ('favorites', 'service_role', 'TRUNCATE'),
        ('favorites', 'service_role', 'REFERENCES'),
        ('favorites', 'service_role', 'TRIGGER'),
        ('favorites', 'authenticated', 'SELECT'),
        ('favorites', 'app_private_writer', 'SELECT'),
        ('favorites', 'app_private_writer', 'INSERT'),
        ('favorites', 'app_private_writer', 'DELETE'),
        ('agent_teams', 'service_role', 'MAINTAIN'),
        ('agent_teams', 'service_role', 'TRUNCATE'),
        ('agent_teams', 'service_role', 'REFERENCES'),
        ('agent_teams', 'service_role', 'TRIGGER'),
        ('agent_teams', 'authenticated', 'SELECT'),
        ('agent_teams', 'app_private_writer', 'SELECT'),
        ('agent_teams', 'app_private_writer', 'INSERT'),
        ('agent_teams', 'app_private_writer', 'DELETE'),
        ('agent_team_avatars', 'service_role', 'MAINTAIN'),
        ('agent_team_avatars', 'service_role', 'TRUNCATE'),
        ('agent_team_avatars', 'service_role', 'REFERENCES'),
        ('agent_team_avatars', 'service_role', 'TRIGGER'),
        ('agent_team_avatars', 'authenticated', 'SELECT'),
        ('agent_team_avatars', 'app_private_writer', 'SELECT'),
        ('agent_team_avatars', 'app_private_writer', 'INSERT'),
        ('agent_team_avatars', 'app_private_writer', 'DELETE')
    ) as expected(table_name, role_name, privilege_name)
    full join (
      select
        pg_class.relname as table_name,
        grantee.rolname as role_name,
        acl.privilege_type as privilege_name,
        acl.is_grantable
      from pg_catalog.pg_class
      join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
      cross join lateral pg_catalog.aclexplode(pg_class.relacl) as acl
      left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
      where pg_namespace.nspname = 'public'
        and pg_class.relname in (
          'profiles',
          'avatars',
          'favorites',
          'agent_teams',
          'agent_team_avatars'
        )
        and grantee.rolname <> 'postgres'
    ) as actual using (table_name, role_name, privilege_name)
    where expected.table_name is null
      or actual.table_name is null
      or actual.is_grantable
  ),
  'non-owner table ACLs exactly match the reviewed role-operation matrix'
);

select ok(
  not exists (
    select 1
    from (
      values ('agent_teams', 'name', 'app_private_writer', 'UPDATE')
    ) as expected(table_name, column_name, role_name, privilege_name)
    full join (
      select
        pg_class.relname as table_name,
        pg_attribute.attname as column_name,
        grantee.rolname as role_name,
        acl.privilege_type as privilege_name,
        acl.is_grantable
      from pg_catalog.pg_attribute
      join pg_catalog.pg_class on pg_class.oid = pg_attribute.attrelid
      join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
      cross join lateral pg_catalog.aclexplode(pg_attribute.attacl) as acl
      left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
      where pg_namespace.nspname = 'public'
        and pg_class.relname in (
          'profiles',
          'avatars',
          'favorites',
          'agent_teams',
          'agent_team_avatars'
        )
    ) as actual using (table_name, column_name, role_name, privilege_name)
    where expected.table_name is null
      or actual.table_name is null
      or actual.is_grantable
  ),
  'the team name is the only column-level writer grant'
);

select ok(
  not exists (
    select 1
    from (
      values
        (
          'profiles',
          'profiles_select_own',
          'PERMISSIVE',
          array['authenticated']::name[],
          'SELECT',
          'auth_owner',
          null
        ),
        (
          'profiles',
          'profiles_writer_select_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'SELECT',
          'writer_owner',
          null
        ),
        (
          'avatars',
          'avatars_select_public',
          'PERMISSIVE',
          array['anon', 'authenticated']::name[],
          'SELECT',
          'public_read',
          null
        ),
        (
          'avatars',
          'avatars_writer_select',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'SELECT',
          'public_read',
          null
        ),
        (
          'favorites',
          'favorites_select_own',
          'PERMISSIVE',
          array['authenticated']::name[],
          'SELECT',
          'auth_owner',
          null
        ),
        (
          'favorites',
          'favorites_writer_select_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'SELECT',
          'writer_owner',
          null
        ),
        (
          'favorites',
          'favorites_writer_insert_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'INSERT',
          null,
          'writer_owner'
        ),
        (
          'favorites',
          'favorites_writer_delete_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'DELETE',
          'writer_owner',
          null
        ),
        (
          'agent_teams',
          'agent_teams_select_own',
          'PERMISSIVE',
          array['authenticated']::name[],
          'SELECT',
          'auth_owner',
          null
        ),
        (
          'agent_teams',
          'agent_teams_writer_select_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'SELECT',
          'writer_owner',
          null
        ),
        (
          'agent_teams',
          'agent_teams_writer_insert_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'INSERT',
          null,
          'writer_owner'
        ),
        (
          'agent_teams',
          'agent_teams_writer_update_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'UPDATE',
          'writer_owner',
          'writer_owner'
        ),
        (
          'agent_teams',
          'agent_teams_writer_delete_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'DELETE',
          'writer_owner',
          null
        ),
        (
          'agent_team_avatars',
          'agent_team_avatars_select_own',
          'PERMISSIVE',
          array['authenticated']::name[],
          'SELECT',
          'auth_team_owner',
          null
        ),
        (
          'agent_team_avatars',
          'agent_team_avatars_writer_select_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'SELECT',
          'writer_team_owner',
          null
        ),
        (
          'agent_team_avatars',
          'agent_team_avatars_writer_insert_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'INSERT',
          null,
          'writer_team_owner'
        ),
        (
          'agent_team_avatars',
          'agent_team_avatars_writer_delete_own',
          'PERMISSIVE',
          array['app_private_writer']::name[],
          'DELETE',
          'writer_team_owner',
          null
        )
    ) as expected(
      table_name,
      policy_name,
      permissive,
      role_names,
      command_name,
      using_kind,
      check_kind
    )
    left join (
      values
        ('public_read', 'true'),
        (
          'auth_owner',
          '((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id))'
        ),
        (
          'writer_owner',
          '((( SELECT private.current_user_id() AS current_user_id) IS NOT NULL) AND (( SELECT private.current_user_id() AS current_user_id) = user_id))'
        ),
        (
          'auth_team_owner',
          '((( SELECT auth.uid() AS uid) IS NOT NULL) AND (EXISTS ( SELECT 1 FROM agent_teams WHERE ((agent_teams.id = agent_team_avatars.team_id) AND (agent_teams.user_id = ( SELECT auth.uid() AS uid))))))'
        ),
        (
          'writer_team_owner',
          '((( SELECT private.current_user_id() AS current_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1 FROM agent_teams WHERE ((agent_teams.id = agent_team_avatars.team_id) AND (agent_teams.user_id = ( SELECT private.current_user_id() AS current_user_id))))))'
        )
    ) as using_expression(kind, expression)
      on using_expression.kind = expected.using_kind
    left join (
      values
        (
          'writer_owner',
          '((( SELECT private.current_user_id() AS current_user_id) IS NOT NULL) AND (( SELECT private.current_user_id() AS current_user_id) = user_id))'
        ),
        (
          'writer_team_owner',
          '((( SELECT private.current_user_id() AS current_user_id) IS NOT NULL) AND (EXISTS ( SELECT 1 FROM agent_teams WHERE ((agent_teams.id = agent_team_avatars.team_id) AND (agent_teams.user_id = ( SELECT private.current_user_id() AS current_user_id))))))'
        )
    ) as check_expression(kind, expression)
      on check_expression.kind = expected.check_kind
    full join (
      select
        tablename as table_name,
        policyname as policy_name,
        permissive,
        roles as role_names,
        cmd as command_name,
        pg_catalog.regexp_replace(qual, '[[:space:]]+', ' ', 'g') as using_expression,
        pg_catalog.regexp_replace(with_check, '[[:space:]]+', ' ', 'g') as check_expression
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in (
          'profiles',
          'avatars',
          'favorites',
          'agent_teams',
          'agent_team_avatars'
        )
    ) as actual
      on actual.table_name = expected.table_name
      and actual.policy_name = expected.policy_name
    where expected.policy_name is null
      or actual.policy_name is null
      or actual.permissive <> expected.permissive
      or actual.role_names <> expected.role_names
      or actual.command_name <> expected.command_name
      or actual.using_expression is distinct from using_expression.expression
      or actual.check_expression is distinct from check_expression.expression
  ),
  'policy names, modes, roles, commands, and predicates exactly match the release contract'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('private.is_sorted_unique_text_array(text[])'::regprocedure, 'postgres', false),
        ('private.set_updated_at()'::regprocedure, 'postgres', false),
        ('private.current_user_id()'::regprocedure, 'postgres', true),
        ('private.create_profile_for_auth_user()'::regprocedure, 'postgres', true),
        ('public.set_favorite(text, boolean)'::regprocedure, 'app_private_writer', true),
        ('public.create_agent_team(uuid, text)'::regprocedure, 'app_private_writer', true),
        ('public.rename_agent_team(uuid, text)'::regprocedure, 'app_private_writer', true),
        ('public.delete_agent_team(uuid)'::regprocedure, 'app_private_writer', true),
        ('public.set_agent_team_members(uuid, text[])'::regprocedure, 'app_private_writer', true),
        ('public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, 'postgres', true)
    ) as expected(function_oid, owner_name, security_definer)
    full join (
      select
        pg_proc.oid as function_oid,
        pg_catalog.pg_get_userbyid(pg_proc.proowner) as owner_name,
        pg_proc.prosecdef as security_definer,
        pg_proc.proconfig
      from pg_catalog.pg_proc
      join pg_catalog.pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where (
        pg_namespace.nspname = 'private'
        and pg_proc.proname in (
          'is_sorted_unique_text_array',
          'set_updated_at',
          'current_user_id',
          'create_profile_for_auth_user'
        )
      ) or (
        pg_namespace.nspname = 'public'
        and pg_proc.proname in (
          'set_favorite',
          'create_agent_team',
          'rename_agent_team',
          'delete_agent_team',
          'set_agent_team_members',
          'sync_avatar_catalog'
        )
      )
    ) as actual using (function_oid, owner_name, security_definer)
    where expected.function_oid is null
      or actual.function_oid is null
      or actual.proconfig <> array['search_path=""']
  ),
  'all application functions retain exact owners, security modes, and empty search paths'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('private.current_user_id()'::regprocedure, 'app_private_writer'),
        ('public.set_favorite(text, boolean)'::regprocedure, 'authenticated'),
        ('public.create_agent_team(uuid, text)'::regprocedure, 'authenticated'),
        ('public.rename_agent_team(uuid, text)'::regprocedure, 'authenticated'),
        ('public.delete_agent_team(uuid)'::regprocedure, 'authenticated'),
        ('public.set_agent_team_members(uuid, text[])'::regprocedure, 'authenticated'),
        ('public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, 'service_role')
    ) as expected(function_oid, role_name)
    full join (
      select
        pg_proc.oid as function_oid,
        grantee.rolname as role_name,
        acl.privilege_type,
        acl.is_grantable
      from pg_catalog.pg_proc
      join pg_catalog.pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      cross join lateral pg_catalog.aclexplode(pg_proc.proacl) as acl
      left join pg_catalog.pg_roles as grantee on grantee.oid = acl.grantee
      where (
        (
          pg_namespace.nspname = 'private'
          and pg_proc.proname in (
            'is_sorted_unique_text_array',
            'set_updated_at',
            'current_user_id',
            'create_profile_for_auth_user'
          )
        ) or (
          pg_namespace.nspname = 'public'
          and pg_proc.proname in (
            'set_favorite',
            'create_agent_team',
            'rename_agent_team',
            'delete_agent_team',
            'set_agent_team_members',
            'sync_avatar_catalog'
          )
        )
      )
      and grantee.rolname <> pg_catalog.pg_get_userbyid(pg_proc.proowner)
    ) as actual using (function_oid, role_name)
    where expected.function_oid is null
      or actual.function_oid is null
      or actual.privilege_type <> 'EXECUTE'
      or actual.is_grantable
  ),
  'non-owner function ACLs expose only the reviewed execution boundaries'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('anon', 'private.is_sorted_unique_text_array(text[])'::regprocedure, false),
        ('authenticated', 'private.is_sorted_unique_text_array(text[])'::regprocedure, false),
        ('service_role', 'private.is_sorted_unique_text_array(text[])'::regprocedure, false),
        ('anon', 'private.set_updated_at()'::regprocedure, false),
        ('authenticated', 'private.set_updated_at()'::regprocedure, false),
        ('service_role', 'private.set_updated_at()'::regprocedure, false),
        ('anon', 'private.current_user_id()'::regprocedure, false),
        ('authenticated', 'private.current_user_id()'::regprocedure, false),
        ('service_role', 'private.current_user_id()'::regprocedure, false),
        ('anon', 'private.create_profile_for_auth_user()'::regprocedure, false),
        ('authenticated', 'private.create_profile_for_auth_user()'::regprocedure, false),
        ('service_role', 'private.create_profile_for_auth_user()'::regprocedure, false),
        ('anon', 'public.set_favorite(text, boolean)'::regprocedure, false),
        ('authenticated', 'public.set_favorite(text, boolean)'::regprocedure, true),
        ('service_role', 'public.set_favorite(text, boolean)'::regprocedure, false),
        ('anon', 'public.create_agent_team(uuid, text)'::regprocedure, false),
        ('authenticated', 'public.create_agent_team(uuid, text)'::regprocedure, true),
        ('service_role', 'public.create_agent_team(uuid, text)'::regprocedure, false),
        ('anon', 'public.rename_agent_team(uuid, text)'::regprocedure, false),
        ('authenticated', 'public.rename_agent_team(uuid, text)'::regprocedure, true),
        ('service_role', 'public.rename_agent_team(uuid, text)'::regprocedure, false),
        ('anon', 'public.delete_agent_team(uuid)'::regprocedure, false),
        ('authenticated', 'public.delete_agent_team(uuid)'::regprocedure, true),
        ('service_role', 'public.delete_agent_team(uuid)'::regprocedure, false),
        ('anon', 'public.set_agent_team_members(uuid, text[])'::regprocedure, false),
        ('authenticated', 'public.set_agent_team_members(uuid, text[])'::regprocedure, true),
        ('service_role', 'public.set_agent_team_members(uuid, text[])'::regprocedure, false),
        ('anon', 'public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, false),
        ('authenticated', 'public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, false),
        ('service_role', 'public.sync_avatar_catalog(jsonb, jsonb)'::regprocedure, true)
    ) as expected(role_name, function_oid, can_execute)
    where pg_catalog.has_function_privilege(
      expected.role_name,
      expected.function_oid,
      'EXECUTE'
    ) <> expected.can_execute
  ),
  'anon, authenticated, and service-role execution boundaries are exact for every function'
);

select * from finish();
rollback;
