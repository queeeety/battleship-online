import { describe, it, expect } from "vitest";
import {
    defaultActionLabel,
    errorText,
    errorPresentation,
    isToastFailure,
    toErrorKind,
    SERVER_FAILURES,
    type ErrorPresentation,
    type ServerFailure
} from "../../components/feedback/ErrorState";
import { JoinError, PlacementError } from "../../lib/enums";
import { PLAYER_NAME_MAX_LENGTH } from "../../lib/config";

// Numeric enums also hold reverse names ("CODE_NOT_FOUND" -> 0), so keep only the numbers
function enumValues<T extends number>(e: Record<string, string | number>): T[] {
    return Object.values(e).filter((v): v is T => typeof v === "number");
}

const JOIN_ERRORS = enumValues<JoinError>(JoinError);
const PLACEMENT_ERRORS = enumValues<PlacementError>(PlacementError);

function expectFilled(text: { title: string; detail: string }): void {
    expect(text.title.trim()).not.toBe("");
    expect(text.detail.trim()).not.toBe("");
}

describe("errorText", () => {
    it.each(JOIN_ERRORS)("has text for JoinError %s", (error) => {
        expectFilled(errorText({ kind: "join", error }));
    });

    it.each(PLACEMENT_ERRORS)("has text for PlacementError %s", (error) => {
        expectFilled(errorText({ kind: "placement", error }));
    });

    it.each(SERVER_FAILURES)("has text for server failure %s", (error) => {
        expectFilled(errorText({ kind: "server", error }));
    });

    // Copied from ErrorState.tsx before the server kind was added
    it("keeps the join copy unchanged", () => {
        expect(JOIN_ERRORS.map((error) => errorText({ kind: "join", error }))).toEqual([
            { title: "Code not found", detail: "Check the code and try again." },
            { title: "Lobby is full", detail: "This game already has two players." },
            { title: "Game has finished", detail: "This game is over. Start a new one from the home screen." },
            {
                title: "Name not allowed",
                detail: `Use 1 to ${PLAYER_NAME_MAX_LENGTH} characters, or leave it blank for a random name.`
            }
        ]);
    });

    it("keeps the placement copy unchanged", () => {
        expect(PLACEMENT_ERRORS.map((error) => errorText({ kind: "placement", error }))).toEqual([
            { title: "Ship is off the board", detail: "Move or rotate it so it fits inside the grid." },
            { title: "Ships overlap", detail: "Ships can't share a cell. Move it to an empty spot." },
            { title: "Ship already placed", detail: "Pick a ship that isn't on the board yet." },
            { title: "Fleet not ready", detail: "Place every ship before you confirm." }
        ]);
    });
});

describe("errorPresentation", () => {
    const expected: Record<ServerFailure, ErrorPresentation> = {
        MOVE_REFUSED: "toast",
        RATE_LIMITED: "toast",
        STALE: "toast",
        INVALID_INPUT: "toast",
        NOT_SEATED: "screen",
        SERVER_ERROR: "screen"
    };

    it.each(SERVER_FAILURES)("puts %s in the right group", (error) => {
        expect(errorPresentation(error)).toBe(expected[error]);
    });

    it.each(JOIN_ERRORS)("shows JoinError %s as a screen", (error) => {
        expect(errorPresentation(error)).toBe("screen");
    });

    // The guard is only trusted by the compiler, so check it matches the table
    it.each(SERVER_FAILURES)("isToastFailure agrees with the table for %s", (error) => {
        expect(isToastFailure(error)).toBe(expected[error] === "toast");
    });

    it.each(JOIN_ERRORS)("isToastFailure is false for JoinError %s", (error) => {
        expect(isToastFailure(error)).toBe(false);
    });
});

describe("defaultActionLabel", () => {
    it.each(JOIN_ERRORS)("has a label for JoinError %s", (error) => {
        expect(defaultActionLabel({ kind: "join", error }).trim()).not.toBe("");
    });

    it.each(PLACEMENT_ERRORS)("has a label for PlacementError %s", (error) => {
        expect(defaultActionLabel({ kind: "placement", error }).trim()).not.toBe("");
    });

    it.each(SERVER_FAILURES)("has a label for server failure %s", (error) => {
        expect(defaultActionLabel({ kind: "server", error }).trim()).not.toBe("");
    });

    it("sends a player with no seat home", () => {
        expect(defaultActionLabel({ kind: "server", error: "NOT_SEATED" })).toBe("Go home");
    });
});

describe("toErrorKind", () => {
    it.each(JOIN_ERRORS)("maps JoinError %s to the join kind", (error) => {
        expect(toErrorKind(error)).toEqual({ kind: "join", error });
    });

    it.each(SERVER_FAILURES)("maps %s to the server kind", (error) => {
        expect(toErrorKind(error)).toEqual({ kind: "server", error });
    });
});
