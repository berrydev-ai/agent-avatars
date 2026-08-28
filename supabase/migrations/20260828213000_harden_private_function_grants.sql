revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.current_user_id() to app_private_writer;

alter default privileges for role postgres in schema private
revoke execute on functions from public;
