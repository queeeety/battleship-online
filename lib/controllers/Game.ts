import { GameState, EndReason, ShotResult } from "../enums";
import type { GameType } from "../enums";
import type { Coordinate } from "../entities/board";
import type { Player } from "../entities/players";
import { GameResult } from "../entities/game/GameResult";
import type { Shot, RematchRequest } from "../entities/game";
import { drawRandomAbility } from "../abilities/registry";
import { Reroute } from "../abilities/Reroute";
import { MAX_PLAYERS, TURN_TIME_LIMIT_SECONDS } from "../config";

/**
 * Runs one match from placement to game over.
 * Handles turns, shots, abilities and the win check.
 * On the server this is the real one, in AI mode it runs in the browser.
 */
export class Game
{
    private id: string;
    private state: GameState;
    private gameType: GameType;
    private players: Player[];
    private shots: Shot[];
    private currentTurn: Player | null;
    private winner: Player | null;
    private turnStartedAt: Date | null;
    private endReason: EndReason | null;
    private finishedAt: Date | null;
    private doubleShotActive: boolean;
    private rematchRequest: RematchRequest | null;

    constructor(gameType: GameType)
    {
        this.id = crypto.randomUUID();
        this.state = GameState.PLACEMENT;
        this.gameType = gameType;
        this.players = [];
        this.shots = [];
        this.currentTurn = null;
        this.winner = null;
        this.turnStartedAt = null;
        this.endReason = null;
        this.finishedAt = null;
        this.doubleShotActive = false;
        this.rematchRequest = null;
    }

    public addPlayer(p: Player): boolean
    {
        if (this.state !== GameState.PLACEMENT) return false;
        if (this.players.length >= MAX_PLAYERS || this.players.includes(p)) return false;
        this.players.push(p);
        return true;
    }

    // both players must have confirmed a complete fleet, then a random player goes first
    public beginBattle(): void
    {
        if (this.state !== GameState.PLACEMENT) throw new Error("The battle has already started");
        if (this.players.length !== MAX_PLAYERS || !this.players.every(p => p.getIsReady()))
        {
            throw new Error("Both players need to place their fleet first");
        }
        this.currentTurn = this.players[Math.floor(Math.random() * this.players.length)];
        this.state = GameState.IN_PROGRESS;
        this.turnStartedAt = new Date();
    }

    // a hit fires again, a miss passes the turn unless Double Shot absorbs it
    public fireShot(shooter: Player, target: Coordinate): Shot
    {
        this.assertTurnOf(shooter);

        const opponent = this.opponentOf(shooter);
        const shot = opponent.getBoard().receiveShot(target, shooter);
        this.shots.push(shot);
        shooter.recordShot(shot);
        this.turnStartedAt = new Date();

        // the win check comes first, so sinking the last ship grants nothing
        if (opponent.hasLost())
        {
            this.declareWinner(shooter, EndReason.FLEET_DESTROYED);
        }
        else if (shot.getResult() === ShotResult.SUNK)
        {
            // the ability goes to the player who lost the ship
            this.grantAbility(opponent);
        }
        else if (shot.getResult() === ShotResult.MISS)
        {
            if (this.doubleShotActive) this.doubleShotActive = false;
            else this.switchTurn();
        }
        return shot;
    }

    // used when the turn timer runs out
    public fireRandomShot(p: Player): Shot
    {
        const options = this.opponentOf(p).getBoard().getUntargetedCoordinates();
        if (options.length === 0) throw new Error("No squares left to fire at");
        return this.fireShot(p, options[Math.floor(Math.random() * options.length)]);
    }

    public isTurnExpired(now: Date = new Date()): boolean
    {
        if (this.state !== GameState.IN_PROGRESS || !this.turnStartedAt) return false;
        const limitMs = TURN_TIME_LIMIT_SECONDS[this.gameType] * 1000;
        return now.getTime() - this.turnStartedAt.getTime() > limitMs;
    }

    public switchTurn(): void
    {
        if (!this.currentTurn) return;
        this.currentTurn = this.opponentOf(this.currentTurn);
        this.turnStartedAt = new Date();
    }

    // draws one of the four, but never a Reroute that has nowhere to go
    public grantAbility(p: Player): void
    {
        let drawn = drawRandomAbility();
        if (drawn instanceof Reroute && !this.canReroute(p, drawn))
        {
            drawn = drawRandomAbility([drawn.getName()]);
        }
        p.receiveAbility(drawn);
    }

    private canReroute(p: Player, reroute: Reroute): boolean
    {
        const board = p.getBoard();
        return board.getShips().some(s => !s.isDamaged() && reroute.validPositions(board, s).length > 0);
    }

    // throws without using the ability if it can't be used or the target is invalid
    public applyAbility(p: Player, target: Coordinate): void
    {
        this.assertTurnOf(p);

        const ability = p.getHeldAbility();
        if (!ability) throw new Error(`${p.getName()} has no ability to use`);
        if (!ability.canUse(this)) throw new Error(`${ability.getName()} can't be used right now`);

        // Reroute moves one of your own ships, everything else targets the opponent
        const board = ability instanceof Reroute ? p.getBoard() : this.opponentOf(p).getBoard();
        if (!ability.isValidTarget(board, target)) throw new Error(`Invalid target for ${ability.getName()}`);

        ability.apply(this, board, target);
        p.consumeAbility();
        if (ability.getUsesTurnShot()) this.switchTurn();
    }

    public setDoubleShotActive(on: boolean): void { this.doubleShotActive = on; }

    public checkWinCondition(): boolean { return this.players.some(p => p.hasLost()); }

    public declareWinner(p: Player, r: EndReason): void
    {
        if (this.state === GameState.FINISHED) return;
        this.winner = p;
        this.endReason = r;
        this.state = GameState.FINISHED;
        this.finishedAt = new Date();
        this.doubleShotActive = false;
        for (const player of this.players) player.clearAbilities();
    }

    public forfeit(p: Player): void { this.declareWinner(this.opponentOf(p), EndReason.OPPONENT_FORFEIT); }

    public resultFor(p: Player): GameResult
    {
        const own = this.shots.filter(s => s.getShooter() === p);
        const hits = own.filter(s => s.isHit()).length;
        const sunk = own.filter(s => s.getResult() === ShotResult.SUNK).length;
        const accuracy = own.length === 0 ? 0 : hits / own.length;
        return new GameResult(this.winner === p, own.length, accuracy, sunk);
    }

    public opponentOf(p: Player): Player
    {
        const other = this.players.find(player => player !== p);
        if (!other || !this.players.includes(p)) throw new Error(`${p.getName()} is not in this game`);
        return other;
    }

    private assertTurnOf(p: Player): void
    {
        if (this.state !== GameState.IN_PROGRESS) throw new Error("The battle isn't in progress");
        if (this.currentTurn !== p) throw new Error(`It's not ${p.getName()}'s turn`);
    }

    public getId(): string { return this.id; }

    public getState(): GameState { return this.state; }

    public getGameType(): GameType { return this.gameType; }

    public getPlayers(): Player[] { return this.players; }

    public getCurrentTurn(): Player | null { return this.currentTurn; }

    public getShots(): Shot[] { return this.shots; }

    public getWinner(): Player | null { return this.winner; }

    public getEndReason(): EndReason | null { return this.endReason; }

    public getFinishedAt(): Date | null { return this.finishedAt; }

    public getTurnStartedAt(): Date | null { return this.turnStartedAt; }

    public isDoubleShotActive(): boolean { return this.doubleShotActive; }

    public getRematchRequest(): RematchRequest | null { return this.rematchRequest; }
}
