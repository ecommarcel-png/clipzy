/* eslint-disable @next/next/no-img-element -- hourly-signed storage URLs gain nothing from next/image */
import Link from "next/link";
import { Badge, cx } from "@/components/ui";

// Products as vertical cards — the same "clip" shape as the Clipzy mark.
export function ProductTile({ href, name, ready, image }: { href: string; name: string; ready: boolean; image?: string }) {
  return (
    <Link
      href={href}
      className="group relative block aspect-[4/5] overflow-hidden rounded-[20px] border border-border bg-surface-2 transition hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent"
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl font-extrabold text-faint">{name.slice(0, 1).toUpperCase()}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#100c16] via-[#100c16]/80 to-transparent p-3 pt-12">
        <div className="line-clamp-2 text-sm font-bold leading-snug">{name}</div>
        <div className="mt-1.5">{ready ? <Badge tone="ok" dot>Gotowy</Badge> : <Badge tone="warn" dot>Do zatwierdzenia</Badge>}</div>
      </div>
    </Link>
  );
}

export function AddTile({ href, first }: { href: string; first?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-border p-4 text-center text-muted transition hover:border-accent hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-accent",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xl font-extrabold text-on-accent">+</span>
      <span className="text-sm font-bold">{first ? "Dodaj pierwszy produkt" : "Dodaj produkt"}</span>
      {first ? <span className="text-xs text-faint">Wystarczy link do produktu.</span> : null}
    </Link>
  );
}
