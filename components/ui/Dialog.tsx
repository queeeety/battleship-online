"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  /** A question, e.g. "Forfeit this game?" */
  title: string;
  children?: ReactNode;
  /** Buttons: the safe option first, the action last. */
  actions?: ReactNode;
  /** Called on Escape and on a click outside the dialog. */
  onClose?: () => void;
  /** Render in place without the scrim taking over the page (docs only). */
  inline?: boolean;
}

export function Dialog({ open, title, children, actions, onClose, inline }: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // showModal() keeps Tab inside, makes the page behind inert and restores focus on close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const panel = (
    <div className="mb-dialog-panel">
      <h2 id={titleId} className="mb-dialog-title">
        {title}
      </h2>
      {children && <div className="mb-dialog-body">{children}</div>}
      {actions && <div className="mb-row mb-row-end">{actions}</div>}
    </div>
  );

  if (inline) {
    if (!open) return null;
    return (
      <div className="mb-scrim">
        <div className="mb-dialog" role="dialog" aria-labelledby={titleId}>
          {panel}
        </div>
      </div>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="mb-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: the parent decides, through onClose
        e.preventDefault();
        onClose?.();
      }}
      onClose={() => {
        // the browser can still force-close on a repeated Escape
        if (open) onClose?.();
      }}
      onClick={(e) => {
        // the panel fills the dialog, so a click on the dialog itself is on the backdrop
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {open && panel}
    </dialog>
  );
}
