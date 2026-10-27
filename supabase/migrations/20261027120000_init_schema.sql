-- Battleship schema: the tables the domain objects are saved into.
--
--   games         public state both seated players may see (Lobby, Game, Player, Shot, RematchRequest)
--   game_secrets  both fleets and the scan log, server (service role) only (Board, Cell, Ship)
--
-- Coordinates are zero-based {row, col}, so H8 is {"row": 7, "col": 7}.
-- The TypeScript enums are numeric; the columns use lowercase text and GameRepository maps between them.
-- The broadcast trigger, fire_shot() and the pg_cron sweep live in their own migrations.

-- ---------------------------------------------------------------- games

create table public.games
(
    code                text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),

    -- Lobby
    lobby_status        text not null default 'waiting'
                        check (lobby_status in ('waiting', 'in_progress', 'finished', 'abandoned')),
    game_type           text not null check (game_type in ('beginner', 'original', 'quickfire')),

    -- Players (player 2 is empty until someone joins)
    player1_id          uuid not null references auth.users (id) on delete cascade,
    player2_id          uuid references auth.users (id) on delete set null,
    player1_name        text not null check (char_length(player1_name) between 1 and 16),
    player2_name        text check (char_length(player2_name) between 1 and 16),
    ready_p1            boolean not null default false,
    ready_p2            boolean not null default false,
    disconnected_at_p1  timestamptz,
    disconnected_at_p2  timestamptz,

    -- Game (no game_state until the guest joins and placement starts)
    game_state          text check (game_state in ('placement', 'in_progress', 'finished')),
    turn                smallint check (turn in (1, 2)),
    turn_started_at     timestamptz,
    double_shot_active  boolean not null default false,
    winner              smallint check (winner in (1, 2)),
    end_reason          text check (end_reason in ('fleet_destroyed', 'opponent_forfeit', 'opponent_disconnected')),
    finished_at         timestamptz,

    -- Shots: lists of {row, col, result}, result is 'miss' | 'hit' | 'sunk'
    shots_p1            jsonb not null default '[]' check (jsonb_typeof(shots_p1) = 'array'),
    shots_p2            jsonb not null default '[]' check (jsonb_typeof(shots_p2) = 'array'),

    -- Abilities: held, plus a new draw waiting on keep-or-replace
    ability_p1          text check (ability_p1 in ('double_shot', 'radar_sweep', 'line_scan', 'reroute')),
    ability_p2          text check (ability_p2 in ('double_shot', 'radar_sweep', 'line_scan', 'reroute')),
    offered_ability_p1  text check (offered_ability_p1 in ('double_shot', 'radar_sweep', 'line_scan', 'reroute')),
    offered_ability_p2  text check (offered_ability_p2 in ('double_shot', 'radar_sweep', 'line_scan', 'reroute')),

    -- RematchRequest
    rematch_by          smallint check (rematch_by in (1, 2)),
    rematch_status      text not null default 'none'
                        check (rematch_status in ('none', 'requested', 'accepted', 'declined')),

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    constraint different_players check (player2_id is null or player2_id <> player1_id),
    constraint winner_when_finished check ((game_state = 'finished') = (winner is not null))
);

-- the idle-lobby sweep looks for old rows
create index games_updated_at_idx on public.games (updated_at);

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger games_touch_updated_at
    before update on public.games
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- game_secrets

create table public.game_secrets
(
    code        text primary key references public.games (code) on delete cascade,

    -- Board snapshots, see BoardSnapshot in lib/entities/board/Board.ts:
    -- { "ships": [{ "name", "row", "col", "orientation": "horizontal" | "vertical" }],
    --   "shots": [{ "row", "col" }] }   hits are replayed from the shots on load
    board_p1    jsonb,
    board_p2    jsonb,

    -- squares each player's scans revealed: { "p1": [{row, col}], "p2": [{row, col}] }
    scan_log    jsonb not null default '{"p1": [], "p2": []}'
);

-- ---------------------------------------------------------------- security
--
-- Clients never write directly: every change goes through a server action using the service role,
-- which bypasses RLS. Anonymous sign-ins use the 'authenticated' role.

alter table public.games enable row level security;
alter table public.game_secrets enable row level security;

-- seated players may read their own game...
create policy "seated players can read their game"
    on public.games for select
    to authenticated
    using ((select auth.uid()) in (player1_id, player2_id));

-- ...but not the ability columns, so nobody can read what their opponent holds.
-- Each player gets their own ability through getMyState.
revoke all on public.games from anon, authenticated;
grant select (
    code, lobby_status, game_type,
    player1_id, player2_id, player1_name, player2_name, ready_p1, ready_p2,
    disconnected_at_p1, disconnected_at_p2,
    game_state, turn, turn_started_at, double_shot_active, winner, end_reason, finished_at,
    shots_p1, shots_p2,
    rematch_by, rematch_status,
    created_at, updated_at
) on public.games to authenticated;

-- no policies and no grants: only the service role can touch the fleets
revoke all on public.game_secrets from anon, authenticated;
