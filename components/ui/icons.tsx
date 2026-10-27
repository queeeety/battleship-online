import type { ReactNode } from "react";

// 24px grid, 1.5px stroke; drawn by Icon in currentColor
export const ICONS = {
  "radar-sweep": (
    <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12 18.4 5.6" /><circle cx="15.5" cy="9.5" r="1.1" className="f" /></>
  ),
  "line-scan": (
    <><rect x="3" y="9" width="18" height="6" rx="1" /><path d="M3 4.5h18M3 19.5h18" /><path d="M7 12h10" /></>
  ),
  "double-shot": (
    <><circle cx="9" cy="9" r="5" /><circle cx="15" cy="15" r="5" /><circle cx="9" cy="9" r="1.1" className="f" /><circle cx="15" cy="15" r="1.1" className="f" /></>
  ),
  "reroute": (
    <><path d="M4 18h8a5 5 0 0 0 5-5V5" /><path d="M13.5 8.5 17 5l3.5 3.5" /><path d="M4 15v6" /></>
  ),
  "target": (
    <><circle cx="12" cy="12" r="7" /><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" /></>
  ),
  "timer": (
    <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2.5" /><path d="M9.5 3h5" /></>
  ),
  "link": (
    <><path d="M10.5 13.5a3.75 3.75 0 0 0 5.3 0l3-3a3.75 3.75 0 0 0-5.3-5.3l-1.1 1.1" /><path d="M13.5 10.5a3.75 3.75 0 0 0-5.3 0l-3 3a3.75 3.75 0 0 0 5.3 5.3l1.1-1.1" /></>
  ),
  "copy": (
    <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5" /><path d="M15.5 8.5V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" /></>
  ),
  "flag": (
    <><path d="M5.5 21V3.5" /><path d="M5.5 4h12l-2.5 4.5L17.5 13h-12" /></>
  ),
  "rotate": (
    <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 3.5v4h-4" /></>
  ),
  "shuffle": (
    <><path d="M3.5 7h3c4.5 0 6.5 10 11 10h3" /><path d="M3.5 17h3c1.7 0 2.9-1.4 3.9-3.2M13.6 10.2C14.6 8.4 15.8 7 17.5 7h3" /><path d="M18 4l3 3-3 3M18 14l3 3-3 3" /></>
  ),
  "offline": (
    <><path d="M2.5 8.8a14 14 0 0 1 19 0" /><path d="M6 12.3a9 9 0 0 1 12 0" /><path d="M9.4 15.7a4 4 0 0 1 5.2 0" /><circle cx="12" cy="19.2" r="1" className="f" /><path d="M3.5 3.5l17 17" /></>
  ),
  "player": (
    <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>
  ),
  "ai": (
    <><rect x="6" y="6" width="12" height="12" rx="1.5" /><rect x="9.5" y="9.5" width="5" height="5" /><path d="M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5" /></>
  ),
  "check": (
    <><path d="M4.5 12.5l5 5 10-11" /></>
  ),
  "close": (
    <><path d="M5.5 5.5l13 13M18.5 5.5l-13 13" /></>
  ),
  "arrow-left": (
    <><path d="M19.5 12h-15M10.5 6l-6 6 6 6" /></>
  ),
  "info": (
    <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.75" r="1" className="f" /></>
  ),
  "warning": (
    <><path d="M12 3.5 21.5 20h-19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.25" r="1" className="f" /></>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
