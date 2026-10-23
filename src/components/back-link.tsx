import Link from "next/link";
import type { ReactNode } from "react";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
      <span aria-hidden className="text-base leading-none">‹</span>
      {children}
    </Link>
  );
}
