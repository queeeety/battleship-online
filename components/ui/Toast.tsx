import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface ToastProps {
  tone?: "neutral" | "hit" | "sonar";
  icon?: IconName;
  children: ReactNode;
  onClose?: () => void;
}

export function Toast({ tone = "neutral", icon, children, onClose }: ToastProps) {
  return (
    <div className={`mb-toast is-${tone}`} role="status">
      {icon && <Icon name={icon} size={20} />}
      <span className="mb-toast-body">{children}</span>
      {onClose && (
        <button type="button" className="mb-toast-x" aria-label="Dismiss" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
