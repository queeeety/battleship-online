import type { ReactElement } from "react";
import type { JoinError, PlacementError } from "@/lib/enums";

// The enums are numeric and overlap (both start at 0), so the kind has to travel with the value.
export type ErrorStateKind =
    | { kind: "join"; error: JoinError }
    | { kind: "placement"; error: PlacementError };

export type ErrorStateProps = ErrorStateKind & {
    actionLabel?: string;
    onAction?: () => void;
};

export function ErrorState(props: ErrorStateProps): ReactElement | null {
    void props;
    return null;
}
