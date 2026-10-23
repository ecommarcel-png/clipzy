import type { ReactNode } from "react";
import { cx } from "@/components/ui";

// One saved material: vertical thumbnail, AI badge, length. Used by the picker and the product page.
export function LibraryTile({
  name,
  posterUrl,
  kind,
  duration,
  selected,
  dim,
  children,
}: {
  name: string;
  posterUrl: string | null;
  kind: "clip" | "generated";
  duration: number;
  selected?: boolean;
  dim?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "relative aspect-[9/16] overflow-hidden rounded-xl border bg-surface-2 transition",
        selected ? "border-accent ring-2 ring-accent/60" : "border-border",
        dim && "opacity-45",
      )}
    >
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, no optimisation needed
        <img src={posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-2xl text-faint" aria-hidden>▶</div>
      )}
      {kind === "generated" ? <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-on-accent">AI</span> : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#100c16] via-[#100c16]/70 to-transparent px-2 pb-1.5 pt-6 text-[10px] leading-tight">
        <span className="line-clamp-2 break-words">{name}</span>
        {duration ? <span className="mt-0.5 block font-bold tabular-nums text-muted">{duration.toFixed(1).replace(".", ",")} s</span> : null}
      </div>
      {children}
    </div>
  );
}
