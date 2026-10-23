"use client";

import type { ReactNode } from "react";
import { Button, cx } from "@/components/ui";

// Submit button that asks for confirmation first (for destructive actions).
export function ConfirmButton({ message, children, subtle }: { message: string; children: ReactNode; subtle?: boolean }) {
  return (
    <Button
      variant={subtle ? "ghost" : "danger"}
      className={cx(subtle && "text-danger/80 hover:text-danger")}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
