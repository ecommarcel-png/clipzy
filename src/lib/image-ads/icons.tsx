import type { ReactNode } from "react";
import type { AdIcon } from "./templates";

// Line icons (24×24, stroke) for benefits and trust bars in image ads.
const P: Record<AdIcon, ReactNode> = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12l2.3 2.3 4.2-4.5" /></>,
  leaf: <><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19c3-4 6-6.5 9.5-8.5" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  drop: <path d="M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  bolt: <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  truck: <><rect x="2.5" y="6" width="11" height="9" rx="1" /><path d="M13.5 9h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  gift: <><rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5V20h14v-7.5M12 8.5V20" /><path d="M12 8.5C10 4 6.5 5 7.5 7.2c.6 1.2 4.5 1.3 4.5 1.3s3.9-.1 4.5-1.3C17.5 5 14 4 12 8.5z" /></>,
  percent: <><path d="M18 6L6 18" /><circle cx="7.5" cy="7.5" r="2.2" /><circle cx="16.5" cy="16.5" r="2.2" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  snow: <><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" /><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" /></>,
  fire: <path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 3-5.6 3.5-9.3 2.3 1.3 3.5 3.3 3.5 5 1-.6 1.7-1.7 1.8-3 2.4 2 4.2 4.6 4.2 7.4 0 3.5-2.5 6.1-6.5 6.1z" />,
  award: <><circle cx="12" cy="9" r="5.5" /><path d="M8.7 13.4L7.5 21l4.5-2.5 4.5 2.5-1.2-7.6" /></>,
  thumb: <><path d="M7.5 10.5V20H4.5v-9.5z" /><path d="M7.5 10.5l3.6-6.6c1.5 0 2.4 1.1 2.1 2.6l-.7 3.5h5.6a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.4a2 2 0 0 1-2 1.5H7.5" /></>,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.2a4.5 4.5 0 0 0 7 0" /><path d="M9 9.8h.01M15 9.8h.01" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  box: <><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></>,
  money: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  battery: <><rect x="3" y="7" width="16" height="10" rx="2" /><path d="M21 10.5v3" /><path d="M7 10v4M10.5 10v4" /></>,
  hand: <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v7M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3 16.5a1.5 1.5 0 0 1 2.3-1.9L8 17" />,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M10.5 18.5h3" /></>,
  home: <><path d="M3.5 11L12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  car: <><path d="M4 16.5v-4l2-5.2A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.3l2 5.2v4" /><rect x="3" y="12.5" width="18" height="5" rx="1.5" /><circle cx="7.5" cy="15" r="1" /><circle cx="16.5" cy="15" r="1" /><path d="M5 17.5V20M19 17.5V20" /></>,
  paw: <><circle cx="7" cy="9" r="1.8" /><circle cx="17" cy="9" r="1.8" /><circle cx="10" cy="5.5" r="1.8" /><circle cx="14" cy="5.5" r="1.8" /><path d="M12 11.5c-3 0-5.5 3.8-5.5 6 0 1.7 1.4 2.5 3 2.5 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-.8 3-2.5 0-2.2-2.5-6-5.5-6z" /></>,
  baby: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 14.5a3.2 3.2 0 0 0 5 0" /><path d="M9 10.5h.01M15 10.5h.01" /><path d="M12 3.5c-1.2 1.4-1 3 .5 3.5" /></>,
  muscle: <path d="M4 16c1.5-6 4-9.5 7-11l2.5 1.5-1.5 2.5-2-.5-1 4c2.5-2 6.5-2 8.5.5 1.8 2.3 1 5.5-2 6.5-3.5 1.2-8 .5-11.5-3.5z" />,
  brain: <><path d="M12 5.5c-1-1.8-4-2-5.3 0C4.5 5.8 3.8 8 4.6 9.5 3 10.7 3 13.4 4.8 14.5c-.6 2.4 1.4 4.6 3.8 4 .8 1.5 2.4 2 3.4 1.5" /><path d="M12 5.5c1-1.8 4-2 5.3 0 2.2.3 2.9 2.5 2.1 4 1.6 1.2 1.6 3.9-.2 5 .6 2.4-1.4 4.6-3.8 4-.8 1.5-2.4 2-3.4 1.5V5.5z" /></>,
  wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" />,
  chemical: <><path d="M9.5 3h5" /><path d="M10.5 3v6L5 19.2A1.4 1.4 0 0 0 6.3 21h11.4a1.4 1.4 0 0 0 1.3-1.8L13.5 9V3" /><path d="M7.5 15h9" /></>,
  loop: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.7 3.8v4.1h-4.1" /></>,
  pain: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
};

export function Icon({ name, size, color, width = 2, fill = false }: { name: AdIcon; size: number; color: string; width?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? color : "none"} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {P[name] ?? P.check}
    </svg>
  );
}
