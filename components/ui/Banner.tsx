import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface BannerProps {
  tone?: "info" | "warning" | "danger";
  /** Defaults to info, warning or offline by tone. */
  icon?: IconName;
  children: ReactNode;
  /** A small Button. */
  action?: ReactNode;
}

const DEFAULT_ICON: Record<NonNullable<BannerProps["tone"]>, IconName> = {
  info: "info",
  warning: "warning",
  danger: "offline",
};

export function Banner({ tone = "info", icon, children, action }: BannerProps) {
  return (
    <div className={`mb-banner is-${tone}`} role={tone === "info" ? "status" : "alert"}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={20} />
      <div className="mb-banner-body">{children}</div>
      {action}
    </div>
  );
}
