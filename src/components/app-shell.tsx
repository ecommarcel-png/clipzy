import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { ClipzyLogo } from "@/components/logo";
import { NavLinks } from "@/app/(app)/nav-links";

// The signed-in frame: sidebar (logo, account, tools) and the inset content panel.
export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border md:sticky md:top-0 md:h-screen md:w-[248px] md:shrink-0 md:border-b-0">
        <div className="flex h-full flex-col gap-5 p-3 md:px-3 md:py-4">
          <Link href="/brands" className="self-start rounded-md px-2 pt-1 focus-visible:outline-2 focus-visible:outline-accent" aria-label="Clipzy — strona główna">
            <ClipzyLogo height={24} />
          </Link>

          {/* account, where the inspiration has the workspace switcher */}
          <details className="group relative hidden md:block">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2 transition-colors hover:bg-surface-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#f5f5f5,#8a8a8a_45%,#2a2a2a)] text-[11px] font-semibold text-[#0a0a0a]" aria-hidden>
                {email.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={email}>{email}</span>
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden>
                <path d="M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-border-strong bg-surface-2 p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)]">
              <Link href="/settings" className="block rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-surface-3 hover:text-text">Ustawienia i klucze</Link>
              <form action={signOut}>
                <button className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-3 hover:text-text">Wyloguj się</button>
              </form>
            </div>
          </details>

          <NavLinks />

          <div className="mt-auto hidden space-y-3 md:block">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Nowość</div>
              <div className="mt-1.5 text-sm font-medium">Usuwanie napisów</div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">Wymaż wypalone napisy z kilku filmów naraz.</p>
              <Link href="/text-remover" className="mt-2.5 inline-block text-xs font-medium text-text underline-offset-4 hover:underline">Wypróbuj</Link>
            </div>
            <form action={signOut}>
              <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-text">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8M12.5 13.5 16 10l-3.5-3.5M16 10H8" />
                </svg>
                Wyloguj się
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 bg-[#0d0d0d] px-4 py-8 md:my-2 md:mr-2 md:rounded-xl md:border md:border-border md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
