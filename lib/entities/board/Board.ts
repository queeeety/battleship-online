import { Cell } from "./Cell";
import { Coordinate } from "./Coordinate";
import { Ship, createStandardFleet } from "../ships";
import { Shot } from "../game/Shot";
import type { Player } from "../players";
import { Orientation, ShotResult } from "../../enums";
import { BOARD_SIZE } from "../../config";

/**
 * The JSON saved in game_secrets.board_p1 / board_p2.
 * Hits aren't stored, they're replayed from the shots when the board is rebuilt.
 */
export interface BoardSnapshot
{
    ships: { name: string; row: number; col: number; orientation: "horizontal" | "vertical" }[];
    shots: { row: number; col: number }[];
}

/**
 * One player's 10x10 grid and the ships on it.
 * Placement gets checked on the client first and then again on the server.
 */
export class Board
{
    private static readonly SIZE: number = BOARD_SIZE;

    // tries per ship before placeFleetRandomly gives up and starts the fleet again
    private static readonly MAX_PLACEMENT_TRIES = 100;

    private width: number;
    private height: number;
    private cells: Cell[][];
    private ships: Ship[];

    constructor()
    {
        this.width = Board.SIZE;
        this.height = Board.SIZE;
        this.cells = [];
        this.ships = [];
        this.reset();
    }

    public canPlace(s: Ship, start: Coordinate, o: Orientation): boolean
    {
        if (this.ships.includes(s)) return false;
        return Ship.squaresFrom(start, o, s.getLength()).every(sq =>
            sq.isWithinBounds(this.width, this.height) && this.getCell(sq).getShip() === null);
    }

    public placeShip(s: Ship, start: Coordinate, o: Orientation): boolean
    {
        if (!this.canPlace(s, start, o)) return false;
        s.place(start, o);
        for (const sq of s.getCoordinates()) this.getCell(sq).occupy(s);
        this.ships.push(s);
        return true;
    }

    public removeShip(s: Ship): void
    {
        if (!this.ships.includes(s)) return;
        for (const sq of s.getCoordinates()) this.getCell(sq).clear();
        s.unplace();
        this.ships = this.ships.filter(other => other !== s);
    }

    public placeFleetRandomly(): void
    {
        // a ship can jam when the others leave it nowhere to go, so restart the whole fleet
        while (!this.tryPlaceFleetRandomly()) {}
    }

    private tryPlaceFleetRandomly(): boolean
    {
        this.reset();
        for (const ship of createStandardFleet())
        {
            let placed = false;
            for (let i = 0; i < Board.MAX_PLACEMENT_TRIES && !placed; i++)
            {
                const o = Math.random() < 0.5 ? Orientation.HORIZONTAL : Orientation.VERTICAL;
                const start = new Coordinate(Board.randomIndex(this.width), Board.randomIndex(this.height));
                placed = this.placeShip(ship, start, o);
            }
            if (!placed) return false;
        }
        return true;
    }

    public isFleetComplete(): boolean
    {
        const placed = this.ships.map(s => s.getName()).sort();
        const expected = createStandardFleet().map(s => s.getName()).sort();
        return placed.length === expected.length && placed.every((name, i) => name === expected[i]);
    }

    // throws on a square that's off the board or already shot, the turn isn't used up
    public receiveShot(target: Coordinate, shooter: Player): Shot
    {
        const { result, ship } = this.applyShot(target);
        return new Shot(target, result, shooter, result === ShotResult.SUNK && ship ? ship.getName() : null);
    }

    private applyShot(target: Coordinate): { result: ShotResult; ship: Ship | null }
    {
        const cell = this.getCell(target);
        if (cell.isAlreadyShot()) throw new Error(`Square ${target.key()} has already been targeted`);

        const ship = cell.getShip();
        if (!ship)
        {
            cell.markMiss();
            return { result: ShotResult.MISS, ship: null };
        }

        cell.markHit();
        ship.registerHit();
        return { result: ship.isSunk() ? ShotResult.SUNK : ShotResult.HIT, ship };
    }

    public hasBeenTargeted(c: Coordinate): boolean { return this.getCell(c).isAlreadyShot(); }

    public allShipsSunk(): boolean { return this.ships.length > 0 && this.ships.every(s => s.isSunk()); }

    // unshot ship squares in a size x size area, clipped to the board
    public scanArea(topLeft: Coordinate, size: number): Coordinate[]
    {
        const squares: Coordinate[] = [];
        for (let y = topLeft.getY(); y < topLeft.getY() + size; y++)
        {
            for (let x = topLeft.getX(); x < topLeft.getX() + size; x++) squares.push(new Coordinate(x, y));
        }
        return this.unshotShipSquares(squares);
    }

    // unshot ship squares in one row or column
    public scanLine(index: number, isRow: boolean): Coordinate[]
    {
        const squares: Coordinate[] = [];
        const length = isRow ? this.width : this.height;
        for (let i = 0; i < length; i++) squares.push(isRow ? new Coordinate(i, index) : new Coordinate(index, i));
        return this.unshotShipSquares(squares);
    }

    private unshotShipSquares(squares: Coordinate[]): Coordinate[]
    {
        return squares.filter(sq =>
        {
            if (!sq.isWithinBounds(this.width, this.height)) return false;
            const cell = this.getCell(sq);
            return cell.getShip() !== null && !cell.isAlreadyShot();
        });
    }

    // for Reroute: an undamaged ship moves to a spot that covers no square the opponent fired at
    public moveShip(s: Ship, start: Coordinate, o: Orientation): boolean
    {
        if (!this.ships.includes(s) || s.isDamaged()) return false;

        const oldStart = s.getStart();
        const oldOrientation = s.getOrientation();
        if (!oldStart) return false;

        for (const sq of s.getCoordinates()) this.getCell(sq).clear();

        const fits = Ship.squaresFrom(start, o, s.getLength()).every(sq =>
            sq.isWithinBounds(this.width, this.height)
            && this.getCell(sq).getShip() === null
            && !this.getCell(sq).isAlreadyShot());

        s.place(fits ? start : oldStart, fits ? o : oldOrientation);
        for (const sq of s.getCoordinates()) this.getCell(sq).occupy(s);
        return fits;
    }

    public reset(): void
    {
        for (const s of this.ships) s.unplace();
        this.ships = [];
        this.cells = [];
        for (let y = 0; y < this.height; y++)
        {
            const row: Cell[] = [];
            for (let x = 0; x < this.width; x++) row.push(new Cell(new Coordinate(x, y)));
            this.cells.push(row);
        }
    }

    public getCell(c: Coordinate): Cell
    {
        if (!c.isWithinBounds(this.width, this.height)) throw new Error(`Square ${c.key()} is off the board`);
        return this.cells[c.getY()][c.getX()];
    }

    public getUntargetedCoordinates(): Coordinate[]
    {
        return this.cells.flat().filter(cell => !cell.isAlreadyShot()).map(cell => cell.getCoordinate());
    }

    public getShips(): Ship[] { return this.ships; }

    public getWidth(): number { return this.width; }

    public getHeight(): number { return this.height; }

    public toSnapshot(): BoardSnapshot
    {
        const ships = this.ships.map(s =>
        {
            const { row, col } = (s.getStart() as Coordinate).toRowCol();
            const orientation: "horizontal" | "vertical" = s.getOrientation() === Orientation.HORIZONTAL ? "horizontal" : "vertical";
            return { name: s.getName(), row, col, orientation };
        });
        const shots = this.cells.flat().filter(cell => cell.isAlreadyShot()).map(cell => cell.getCoordinate().toRowCol());
        return { ships, shots };
    }

    // throws if the snapshot doesn't describe a legal board
    public static fromSnapshot(snapshot: BoardSnapshot): Board
    {
        const board = new Board();
        const unused = createStandardFleet();
        for (const saved of snapshot.ships)
        {
            const index = unused.findIndex(s => s.getName() === saved.name);
            if (index < 0) throw new Error(`Unknown or duplicate ship "${saved.name}"`);
            const [ship] = unused.splice(index, 1);
            const o = saved.orientation === "horizontal" ? Orientation.HORIZONTAL : Orientation.VERTICAL;
            if (!board.placeShip(ship, Coordinate.fromRowCol(saved.row, saved.col), o))
            {
                throw new Error(`Saved ${saved.name} doesn't fit on the board`);
            }
        }
        for (const shot of snapshot.shots) board.applyShot(Coordinate.fromRowCol(shot.row, shot.col));
        return board;
    }

    private static randomIndex(max: number): number { return Math.floor(Math.random() * max); }
}
