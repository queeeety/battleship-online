"use client";

import { useId } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface TextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  /** Replaces the hint and marks the field invalid. */
  error?: string;
  /** Monospace, uppercase entry for lobby codes. */
  code?: boolean;
  maxLength?: number;
  onChange?: (value: string) => void;
}

export function TextField({ label, hint, error, code, onChange, ...rest }: TextFieldProps) {
  const fieldId = useId();
  const msgId = `${fieldId}-msg`;
  const msg = error || hint;

  return (
    <div className={cx("mb-field", error && "is-invalid", code && "is-code")}>
      <label className="mb-field-label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        {...rest}
        id={fieldId}
        className="mb-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={msg ? msgId : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={
          onChange
            ? (e) => onChange(code ? e.target.value.toUpperCase() : e.target.value)
            : undefined
        }
      />
      {msg && (
        <p id={msgId} className="mb-field-msg">
          {error && <Icon name="warning" size={16} />}
          {msg}
        </p>
      )}
    </div>
  );
}
