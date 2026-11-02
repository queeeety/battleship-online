-- Stage 5: atomic game saves, the broadcast trigger and Realtime permissions.
--
-- The shot rules stay in the TypeScript classes (Game, Board). The server loads the game,
-- applies the rules, then saves the result here in one transaction, only if nobody changed
-- the game since it was loaded. A double-click or a second tab therefore can't land two shots.

-- ---------------------------------------------------------------- save_game

-- Writes a whole game state at once. Returns the new updated_at (the next version),
-- or null if the row changed since p_expected_updated_at, in which case nothing is written.
create function public.save_game(
    p_code text,
    p_expected_updated_at timestamptz,
    p_game jsonb,
    p_board_p1 jsonb,
    p_board_p2 jsonb
) returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
    v_version timestamptz;
begin
    update public.games set
        lobby_status       = p_game->>'lobby_status',
        game_state         = p_game->>'game_state',
        ready_p1           = (p_game->>'ready_p1')::boolean,
        ready_p2           = (p_game->>'ready_p2')::boolean,
        turn               = (p_game->>'turn')::smallint,
        turn_started_at    = (p_game->>'turn_started_at')::timestamptz,
        double_shot_active = (p_game->>'double_shot_active')::boolean,
        winner             = (p_game->>'winner')::smallint,
        end_reason         = p_game->>'end_reason',
        finished_at        = (p_game->>'finished_at')::timestamptz,
        shots_p1           = p_game->'shots_p1',
        shots_p2           = p_game->'shots_p2',
        ability_p1         = p_game->>'ability_p1',
        ability_p2         = p_game->>'ability_p2',
        offered_ability_p1 = p_game->>'offered_ability_p1',
        offered_ability_p2 = p_game->>'offered_ability_p2'
    where code = p_code
      and updated_at = p_expected_updated_at
    returning updated_at into v_version;

    -- stale: someone else saved first (or the game is gone)
    if v_version is null then
        return null;
    end if;

    insert into public.game_secrets (code, board_p1, board_p2)
    values (p_code, p_board_p1, p_board_p2)
    on conflict (code) do update
        set board_p1 = excluded.board_p1,
            board_p2 = excluded.board_p2;

    return v_version;
end;
$$;

-- server only (secret key)
revoke execute on function public.save_game(text, timestamptz, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_game(text, timestamptz, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------- broadcast trigger

-- After every change to a game, pushes its public state to the private channel game:{code}.
-- Fleets live in game_secrets and the ability columns are left out, so neither can leak.
-- The broadcast is a hint: clients refetch with getMyState for anything private.
create function public.broadcast_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object(
            'code', new.code,
            'lobby_status', new.lobby_status,
            'game_type', new.game_type,
            'game_state', new.game_state,
            'player1_name', new.player1_name,
            'player2_name', new.player2_name,
            'ready_p1', new.ready_p1,
            'ready_p2', new.ready_p2,
            'disconnected_at_p1', new.disconnected_at_p1,
            'disconnected_at_p2', new.disconnected_at_p2,
            'turn', new.turn,
            'turn_started_at', new.turn_started_at,
            'double_shot_active', new.double_shot_active,
            'winner', new.winner,
            'end_reason', new.end_reason,
            'finished_at', new.finished_at,
            'shots_p1', new.shots_p1,
            'shots_p2', new.shots_p2,
            'rematch_by', new.rematch_by,
            'rematch_status', new.rematch_status,
            'updated_at', new.updated_at
        ),
        'game_updated',
        'game:' || new.code,
        true
    );
    return null;
end;
$$;

revoke execute on function public.broadcast_game() from public, anon, authenticated;

create trigger games_broadcast
    after insert or update on public.games
    for each row execute function public.broadcast_game();

-- ---------------------------------------------------------------- Realtime permissions
--
-- Channels: game:{code} for both seated players, game:{code}:{userId} for one player only.
-- Players can listen and track presence, but never broadcast: only the server does that.

-- true if the current user is seated in the game the channel topic belongs to
create function public.is_seated_in_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where split_part(p_topic, ':', 1) = 'game'
          and split_part(p_topic, ':', 2) = g.code
          and (select auth.uid()) in (g.player1_id, g.player2_id)
          -- a third part, if present, must be the caller's own user ID
          and (split_part(p_topic, ':', 3) = '' or split_part(p_topic, ':', 3) = (select auth.uid())::text)
    );
$$;

revoke execute on function public.is_seated_in_topic(text) from public, anon;
grant execute on function public.is_seated_in_topic(text) to authenticated;

create policy "seated players receive their game's messages"
    on realtime.messages for select
    to authenticated
    using (
        realtime.messages.extension in ('broadcast', 'presence')
        and public.is_seated_in_topic((select realtime.topic()))
    );

create policy "seated players track presence in their game"
    on realtime.messages for insert
    to authenticated
    with check (
        realtime.messages.extension = 'presence'
        and split_part((select realtime.topic()), ':', 3) = ''
        and public.is_seated_in_topic((select realtime.topic()))
    );
