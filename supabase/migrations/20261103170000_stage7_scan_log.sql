-- Stage 7: save_game also writes the scan log (squares each player's scans revealed), in the same transaction.
-- New optional parameter, so the old five-argument version is replaced. A null scan log leaves it as it is.

drop function public.save_game(text, timestamptz, jsonb, jsonb, jsonb);

create function public.save_game(
    p_code text,
    p_expected_updated_at timestamptz,
    p_game jsonb,
    p_board_p1 jsonb,
    p_board_p2 jsonb,
    p_scan_log jsonb default null
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
        disconnected_at_p1 = (p_game->>'disconnected_at_p1')::timestamptz,
        disconnected_at_p2 = (p_game->>'disconnected_at_p2')::timestamptz,
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
        offered_ability_p2 = p_game->>'offered_ability_p2',
        -- a rematch only means something on a finished game, so leaving finished clears it
        rematch_by         = case when p_game->>'game_state' = 'finished' then rematch_by end,
        rematch_status     = case when p_game->>'game_state' = 'finished' then rematch_status else 'none' end
    where code = p_code
      and updated_at = p_expected_updated_at
    returning updated_at into v_version;

    if v_version is null then
        return null;
    end if;

    insert into public.game_secrets as s (code, board_p1, board_p2, scan_log)
    values (p_code, p_board_p1, p_board_p2, coalesce(p_scan_log, '{"p1": [], "p2": []}'::jsonb))
    on conflict (code) do update
        set board_p1 = excluded.board_p1,
            board_p2 = excluded.board_p2,
            scan_log = coalesce(p_scan_log, s.scan_log);

    return v_version;
end;
$$;

-- server only (secret key)
revoke execute on function public.save_game(text, timestamptz, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_game(text, timestamptz, jsonb, jsonb, jsonb, jsonb) to service_role;
