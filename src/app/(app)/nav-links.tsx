"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS: Array<{ href: string; label: string; soon?: boolean }> = [
  { href: "/brands", label: "Marki i produkty" },
  { href: "/clips", label: "Sklejki", soon: true },
  { href: "/ai-video", label: "AI nagrania", soon: true },
  { href: "/image-ads", label: "Image ads", soon: true },
  { href: "/text-remover", label: "Usuwanie napisów", soon: true },
  { href: "/settings", label: "Ustawienia" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        if (link.soon) {
          return (
            <span key={link.href} className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted/60">
              {link.label}
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">wkrótce</span>
            </span>
          );
        }
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "shrink-0 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-accent-soft font-medium text-accent" : "text-text hover:bg-surface-2",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
