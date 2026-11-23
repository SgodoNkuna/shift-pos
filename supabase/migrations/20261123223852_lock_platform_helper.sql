-- rls_auto_enable() is added by Supabase and runs as an event trigger.
-- It never needs to be called through the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
