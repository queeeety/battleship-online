import { Player } from "./Player";
import { Coordinate } from "../board/Coordinate";
import type { Shot } from "../game";
import type { Ability } from "../../abilities";
import type { Game } from "../../controllers";
import { createStandardFleet } from "../ships";
import { Difficulty, ShotResult } from "../../enums";
import { BOARD_SIZE } from "../../config";
import { DoubleShot } from "../../abilities/DoubleShot";
import { RadarSweep } from "../../abilities/RadarSweep";
import { LineScan } from "../../abilities/LineScan";
import { Reroute } from "../../abilities/Reroute";

/**
 * What the AI remembers between turns, saved to localStorage so a reload restores it.
 */
export interface AIMemory
{
    difficulty: Difficulty;
    targeted: string[];
    activeHits: { x: number; y: number }[];
    huntQueue: { x: number; y: number }[];
}

/**
 * The computer player. Only runs in the browser.
 * Easy fires at random, Normal hunts on a checkerboard then
 * targets the squares next to a hit until the ship sinks.
 * It only learns from its own shots, it never looks at where the ships are.
 * It places its own fleet as soon as it's created, so it's always ready.
 */
export class AIOpponent extends Player
{
    private static readonly RADAR_SIZE = 3;

    private difficulty: Difficulty;
    private huntQueue: Coordinate[];
    private targeted: Set<string>;
    private activeHits: Coordinate[];

    constructor(difficulty: Difficulty)
    {
        super("Computer");
        this.difficulty = difficulty;
        this.huntQueue = [];
        this.targeted = new Set();
        this.activeHits = [];
        this.board.placeFleetRandomly();
        this.confirmPlacement();
    }

    // one AI action: a held ability if it should use one and the ability allows it, otherwise a shot.
    // Returns the shot, or null when the ability used up the turn's shot.
    // The caller keeps calling this while it's still the AI's turn.
    public takeTurn(g: Game): Shot | null
    {
        const ability = this.getHeldAbility();
        if (ability && this.shouldUseAbility() && ability.canUse(g))
        {
            const target = this.chooseAbilityTarget();
            if (target)
            {
                try
                {
                    g.applyAbility(this, target);
                    if (ability.getUsesTurnShot()) return null;
                }
                catch
                {
                    // a rejected target isn't fatal, the AI just fires instead
                }
            }
        }
        return g.fireShot(this, this.chooseTarget());
    }

    // the AI never leaves an offer waiting: it keeps the ability it already holds
    public receiveAbility(drawn: Ability): void
    {
        super.receiveAbility(drawn);
        this.resolveOffer(true);
    }

    public chooseTarget(): Coordinate
    {
        if (this.difficulty === Difficulty.EASY) return this.randomFrom(this.untargeted());
        return this.target() ?? this.hunt();
    }

    public recordShot(s: Shot): void
    {
        const c = s.getCoordinate();
        this.targeted.add(c.key());
        if (this.difficulty === Difficulty.EASY) return;

        if (s.getResult() === ShotResult.HIT)
        {
            this.activeHits.push(c);
            this.queueNeighbours(c);
        }
        else if (s.getResult() === ShotResult.SUNK)
        {
            this.activeHits.push(c);
            this.forgetSunkShip(c, s.getSunkShipName());
            this.huntQueue = [];
            for (const hit of this.activeHits) this.queueNeighbours(hit);
        }
    }

    // scans while hunting, Double Shot while chasing a ship, Reroute straight away
    public shouldUseAbility(): boolean
    {
        const ability = this.getHeldAbility();
        if (!ability) return false;
        if (ability instanceof DoubleShot) return this.activeHits.length > 0;
        if (ability instanceof RadarSweep || ability instanceof LineScan) return this.activeHits.length === 0;
        return ability instanceof Reroute;
    }

    // where to aim the held ability: the area or row with the most squares still unknown,
    // or for Reroute a new spot for one of its own undamaged ships. Null when there's no usable target.
    public chooseAbilityTarget(): Coordinate | null
    {
        const ability = this.getHeldAbility();
        if (ability instanceof RadarSweep) return this.bestRadarCorner();
        if (ability instanceof LineScan)
        {
            ability.setDirection(true);
            return new Coordinate(0, this.bestRow());
        }
        if (ability instanceof Reroute) return this.chooseReroute(ability);
        // Double Shot needs no target
        return ability ? new Coordinate(0, 0) : null;
    }

    // picks the first undamaged ship that has somewhere to go, keeping its orientation
    private chooseReroute(reroute: Reroute): Coordinate | null
    {
        for (const ship of this.board.getShips())
        {
            if (ship.isDamaged()) continue;
            reroute.selectShip(ship);
            reroute.setOrientation(ship.getOrientation());
            const options = reroute.validPositions(this.board, ship);
            if (options.length > 0) return this.randomFrom(options);
        }
        return null;
    }

    // checkerboard: every ship covers at least two squares, so it can't slip between them
    private hunt(): Coordinate
    {
        const open = this.untargeted();
        const parity = open.filter(c => (c.getX() + c.getY()) % 2 === 0);
        return this.randomFrom(parity.length > 0 ? parity : open);
    }

    // the next queued neighbour of a hit, or null when there's nothing left to chase
    private target(): Coordinate | null
    {
        while (this.huntQueue.length > 0)
        {
            const next = this.huntQueue.shift() as Coordinate;
            if (!this.targeted.has(next.key())) return next;
        }
        return null;
    }

    private queueNeighbours(c: Coordinate): void
    {
        const around = [
            new Coordinate(c.getX(), c.getY() - 1),
            new Coordinate(c.getX() + 1, c.getY()),
            new Coordinate(c.getX(), c.getY() + 1),
            new Coordinate(c.getX() - 1, c.getY())
        ];
        for (const n of around)
        {
            if (!n.isWithinBounds(BOARD_SIZE, BOARD_SIZE) || this.targeted.has(n.key())) continue;
            if (this.huntQueue.some(q => q.equals(n))) continue;
            this.huntQueue.push(n);
        }
    }

    // drops the sunk ship's squares from the active hits: the run of hits through
    // the sinking square that is as long as the ship
    private forgetSunkShip(at: Coordinate, shipName: string | null): void
    {
        const length = createStandardFleet().find(s => s.getName() === shipName)?.getLength() ?? 1;
        const hits = new Set(this.activeHits.map(h => h.key()));

        for (const [dx, dy] of [[1, 0], [0, 1]])
        {
            const run = [at];
            for (let i = 1; hits.has(new Coordinate(at.getX() - dx * i, at.getY() - dy * i).key()); i++)
            {
                run.unshift(new Coordinate(at.getX() - dx * i, at.getY() - dy * i));
            }
            for (let i = 1; hits.has(new Coordinate(at.getX() + dx * i, at.getY() + dy * i).key()); i++)
            {
                run.push(new Coordinate(at.getX() + dx * i, at.getY() + dy * i));
            }
            if (run.length < length) continue;

            // the sinking shot is usually at one end, so prefer the window that ends on it
            const atIndex = run.findIndex(c => c.equals(at));
            const startIndex = Math.max(0, Math.min(atIndex - length + 1, run.length - length));
            const sunk = run.slice(startIndex, startIndex + length);
            this.activeHits = this.activeHits.filter(h => !sunk.some(s => s.equals(h)));
            return;
        }
        this.activeHits = this.activeHits.filter(h => !h.equals(at));
    }

    private bestRadarCorner(): Coordinate
    {
        let best = new Coordinate(0, 0);
        let bestCount = -1;
        for (let y = 0; y <= BOARD_SIZE - AIOpponent.RADAR_SIZE; y++)
        {
            for (let x = 0; x <= BOARD_SIZE - AIOpponent.RADAR_SIZE; x++)
            {
                let count = 0;
                for (let dy = 0; dy < AIOpponent.RADAR_SIZE; dy++)
                {
                    for (let dx = 0; dx < AIOpponent.RADAR_SIZE; dx++)
                    {
                        if (!this.targeted.has(new Coordinate(x + dx, y + dy).key())) count++;
                    }
                }
                if (count > bestCount)
                {
                    best = new Coordinate(x, y);
                    bestCount = count;
                }
            }
        }
        return best;
    }

    private bestRow(): number
    {
        let best = 0;
        let bestCount = -1;
        for (let y = 0; y < BOARD_SIZE; y++)
        {
            let count = 0;
            for (let x = 0; x < BOARD_SIZE; x++) if (!this.targeted.has(new Coordinate(x, y).key())) count++;
            if (count > bestCount)
            {
                best = y;
                bestCount = count;
            }
        }
        return best;
    }

    private untargeted(): Coordinate[]
    {
        const open: Coordinate[] = [];
        for (let y = 0; y < BOARD_SIZE; y++)
        {
            for (let x = 0; x < BOARD_SIZE; x++)
            {
                const c = new Coordinate(x, y);
                if (!this.targeted.has(c.key())) open.push(c);
            }
        }
        return open;
    }

    private randomFrom(options: Coordinate[]): Coordinate
    {
        if (options.length === 0) throw new Error("No squares left to fire at");
        return options[Math.floor(Math.random() * options.length)];
    }

    public toJSON(): AIMemory
    {
        return {
            difficulty: this.difficulty,
            targeted: [...this.targeted],
            activeHits: this.activeHits.map(c => ({ x: c.getX(), y: c.getY() })),
            huntQueue: this.huntQueue.map(c => ({ x: c.getX(), y: c.getY() }))
        };
    }

    // restores what the AI remembers, the board comes back with the rest of the game
    public static fromJSON(m: AIMemory): AIOpponent
    {
        const ai = new AIOpponent(m.difficulty);
        ai.targeted = new Set(m.targeted);
        ai.activeHits = m.activeHits.map(c => new Coordinate(c.x, c.y));
        ai.huntQueue = m.huntQueue.map(c => new Coordinate(c.x, c.y));
        return ai;
    }

    public getDifficulty(): Difficulty { return this.difficulty; }
}
