"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";

// Small round submit button with a confirmation — for actions on thumbnails.
export function ConfirmIconButton({ message, label, children, className }: { message: string; label: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      className={cx("flex h-6 w-6 items-center justify-center rounded-full bg-[#100c16]/85 text-xs font-bold text-muted transition hover:bg-danger hover:text-white", className)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
