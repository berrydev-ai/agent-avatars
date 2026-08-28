begin;

select plan(24);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'avatars', 'avatars table exists');
select has_table('public', 'favorites', 'favorites table exists');
select has_table('public', 'agent_teams', 'agent_teams table exists');
select has_table('public', 'agent_team_avatars', 'agent_team_avatars table exists');

select col_is_pk('public', 'profiles', 'user_id', 'profiles are keyed by auth user');
select col_is_pk('public', 'avatars', 'id', 'avatars use stable catalog identity');
select col_is_pk(
  'public',
  'favorites',
  array['user_id', 'avatar_id'],
  'favorite writes are naturally idempotent'
);
select col_is_pk(
  'public',
  'agent_team_avatars',
  array['team_id', 'avatar_id'],
  'an avatar occurs once per team'
);

select has_fk('public', 'profiles', 'profiles reference auth users');
select has_fk('public', 'favorites', 'favorites have referential constraints');
select has_fk('public', 'agent_teams', 'teams reference profiles');
select has_fk('public', 'agent_team_avatars', 'membership has referential constraints');

select col_not_null('public', 'favorites', 'created_at', 'favorite timestamps are required');
select col_not_null('public', 'agent_teams', 'name', 'team names are required');
select col_not_null('public', 'agent_team_avatars', 'position', 'member order is required');
select col_not_null('public', 'avatars', 'publication_status', 'avatar availability is explicit');

select has_function('public', 'set_favorite', array['text', 'boolean'], 'favorite mutation RPC exists');
select has_function('public', 'create_agent_team', array['uuid', 'text'], 'team create RPC exists');
select has_function('public', 'rename_agent_team', array['uuid', 'text'], 'team rename RPC exists');
select has_function('public', 'delete_agent_team', array['uuid'], 'team delete RPC exists');
select has_function(
  'public',
  'set_agent_team_members',
  array['uuid', 'text[]'],
  'atomic membership RPC exists'
);
select has_function(
  'public',
  'sync_avatar_catalog',
  array['jsonb', 'jsonb'],
  'privileged catalog synchronization RPC exists'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'app_private_writer'
      and not rolcanlogin
      and not rolbypassrls
  ),
  'private writer is NOLOGIN and NOBYPASSRLS'
);

select * from finish();
rollback;
