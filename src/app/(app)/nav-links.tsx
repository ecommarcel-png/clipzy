"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const ICONS = {
  brands: icon(<><path d="M3 8.5 4.2 4h11.6L17 8.5" /><path d="M3 8.5a2.3 2.3 0 0 0 4.7 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.7 0" /><path d="M4.5 10.5V16h11v-5.5" /></>),
  clips: icon(<><path d="M5.5 5.2 3 5.9l2.4 9 1.3-.4" /><path d="m14.5 5.2 2.5.7-2.4 9-1.3-.4" /><rect x="6.5" y="3.5" width="7" height="13" rx="2" /><path d="m9.2 8 2.6 2-2.6 2z" fill="currentColor" stroke="none" /></>),
  ai: icon(<><path d="M10 2.8 11.6 8.4 17.2 10l-5.6 1.6L10 17.2l-1.6-5.6L2.8 10l5.6-1.6z" /></>),
  image: icon(<><rect x="3" y="3.5" width="14" height="13" rx="2.5" /><circle cx="7.5" cy="8" r="1.4" /><path d="m3.5 14 4-3.5 3 2.5 2.5-2 3.5 3" /></>),
  eraser: icon(<><path d="m8 16.5-4.3-4.3a1.5 1.5 0 0 1 0-2.1l6.4-6.4a1.5 1.5 0 0 1 2.1 0l4.3 4.3a1.5 1.5 0 0 1 0 2.1L11 16.5z" /><path d="M8 16.5h9" /><path d="m6.5 8 5.5 5.5" /></>),
  settings: icon(<><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>),
};

const LINKS: Array<{ href: string; label: string; icon: ReactNode; soon?: boolean }> = [
  { href: "/brands", label: "Marki i produkty", icon: ICONS.brands },
  { href: "/clips", label: "Sklejki", icon: ICONS.clips },
  { href: "/ai-video", label: "AI nagrania", icon: ICONS.ai, soon: true },
  { href: "/image-ads", label: "Image ads", icon: ICONS.image, soon: true },
  { href: "/text-remover", label: "Usuwanie napisów", icon: ICONS.eraser, soon: true },
  { href: "/settings", label: "Ustawienia", icon: ICONS.settings },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        if (link.soon) {
          return (
            <span key={link.href} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm text-faint" title="Wkrótce">
              {link.icon}
              <span className="flex-1">{link.label}</span>
              <span className="hidden rounded-full border border-border px-1.5 text-[10px] md:inline">wkrótce</span>
            </span>
          );
        }
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
              active ? "bg-surface-3 font-bold text-text shadow-[inset_0_1px_0_rgb(255_243_232/0.06)]" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <span className={active ? "text-accent" : undefined}>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
