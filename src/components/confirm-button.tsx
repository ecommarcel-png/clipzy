"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";

// Submit button that asks for confirmation first (for destructive actions).
export function ConfirmButton({ message, children }: { message: string; children: ReactNode }) {
  return (
    <Button
      variant="danger"
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
