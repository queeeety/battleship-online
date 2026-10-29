"use client";

import { useId } from "react";
import { cx } from "./cx";

export interface SegmentOption {
  value: string;
  label: string;
  /** The fact that matters, in mono, e.g. "15 s turns". */
  meta?: string;
}

export interface SegmentedControlProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange?: (value: string) => void;
  name?: string;
}

// radio inputs underneath, so arrow keys work
export function SegmentedControl({ label, options, value, onChange, name }: SegmentedControlProps) {
  const autoName = useId();
  const groupName = name ?? autoName;

  return (
    <fieldset className="mb-seg">
      <legend className="mb-field-label">{label}</legend>
      <div className="mb-seg-track">
        {options.map((o) => (
          <label key={o.value} className={cx("mb-seg-item", o.value === value && "is-on")}>
            <input
              type="radio"
              name={groupName}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange?.(o.value)}
            />
            <span className="mb-seg-label">{o.label}</span>
            {o.meta && <span className="mb-seg-meta">{o.meta}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
