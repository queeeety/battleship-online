-- Stage 6: the pg_cron sweep that cleans up idle and abandoned lobbies.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 1. A waiting lobby whose host stopped checking in is closed, as joinLobby would (backup for no join attempt).
-- 2. Abandoned lobbies are deleted after an hour, so both screens can still show the result first.
-- 3. Anything nobody has touched for 24 hours is deleted.
-- Fleets in game_secrets go with their row (on delete cascade).
create function public.sweep_idle_lobbies()
returns void
language sql
security definer
set search_path = ''
as $$
    update public.games
       set lobby_status = 'abandoned'
     where lobby_status = 'waiting'
       and updated_at < now() - interval '30 seconds';

    delete from public.games
     where updated_at < now() - interval '24 hours'
        or (lobby_status = 'abandoned' and updated_at < now() - interval '1 hour');
$$;

revoke execute on function public.sweep_idle_lobbies() from public, anon, authenticated;

select cron.schedule('sweep-idle-lobbies', '*/15 * * * *', 'select public.sweep_idle_lobbies()');
