import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export interface ButtonProps extends Omit<ComponentProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: IconName;
  /** Icon-only button; the children text becomes the aria-label. */
  iconOnly?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  block,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        "mb-btn",
        `mb-btn-${variant}`,
        `mb-btn-${size}`,
        iconOnly && "mb-btn-icononly",
        block && "mb-btn-block",
        className,
      )}
      aria-label={iconOnly && typeof children === "string" ? children : rest["aria-label"]}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      {!iconOnly && <span>{children}</span>}
    </button>
  );
}
