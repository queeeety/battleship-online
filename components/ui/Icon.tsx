import { ICONS, type IconName } from "./icons";

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 24;
  /** Only when the icon stands alone and carries meaning; otherwise it is hidden from screen readers. */
  label?: string;
}

export function Icon({ name, size = 20, label }: IconProps) {
  return (
    <svg
      className="mb-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {ICONS[name]}
    </svg>
  );
}
