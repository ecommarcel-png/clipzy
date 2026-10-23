import React from "react";
import type { IconName } from "@/lib/clips/plan";

// Simple line icons (24×24) drawn for Clipzy — used by pop-up / struck-through effects.
export const ICON_PATHS: Record<IconName, React.ReactNode> = {
  razor: <><rect x="5" y="3" width="14" height="5.5" rx="1.6" /><path d="M7.5 5.75h9" /><path d="M12 8.5v12.5" /><path d="M10.6 21h2.8" /></>,
  wax: <><rect x="4" y="7" width="16" height="7" rx="1.5" /><path d="M7 10.5h10" /><path d="M16 14l3 4" /><path d="M8 14l-2 5" /></>,
  foam: <><rect x="7" y="8.5" width="10" height="12.5" rx="2.2" /><path d="M9.8 8.5V5.5h4.4v3" /><path d="M14.2 6.2h3.3" /><circle cx="19" cy="4" r="1.2" /><circle cx="20.6" cy="7" r="0.9" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6.5 8h11v3.2a5.5 5.5 0 0 1-11 0z" /><path d="M12 16.7V21" /></>,
  battery: <><rect x="3" y="7" width="16" height="10" rx="2" /><path d="M21 10.5v3" /><path d="M7 10v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  money: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  pain: <><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></>,
  scissors: <><circle cx="6.5" cy="17" r="2.6" /><circle cx="17.5" cy="17" r="2.6" /><path d="M8.5 15.3L18 4M15.5 15.3L6 4" /></>,
  bottle: <><path d="M10 2.5h4v3l1.5 2.5V20a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20V8L10 5.5z" /><path d="M8.5 12h7" /></>,
  cream: <><path d="M5 11h14l-1.2 8.3a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z" /><rect x="6.5" y="7" width="11" height="4" rx="1" /></>,
  chemical: <><path d="M9.5 3h5" /><path d="M10.5 3v6L5 19.2A1.4 1.4 0 0 0 6.3 21h11.4a1.4 1.4 0 0 0 1.3-1.8L13.5 9V3" /><path d="M7.5 15h9" /></>,
  drop: <><path d="M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z" /></>,
  trash: <><path d="M4.5 6.5h15" /><path d="M9.5 6.5V4h5v2.5" /><path d="M6.5 6.5l1 13.5h9l1-13.5" /></>,
  box: <><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></>,
  truck: <><rect x="2.5" y="6" width="11" height="9" rx="1" /><path d="M13.5 9h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  heart: <><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></>,
  star: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></>,
  loop: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.7 3.8v4.1h-4.1" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  bolt: <><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M10.5 18.5h3" /></>,
  hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v7M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3 16.5a1.5 1.5 0 0 1 2.3-1.9L8 17" /></>,
};

export function Icon({ name, size, color = "#1C1A1E", sw = 1.9 }: { name: IconName; size: number; color?: string; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}
