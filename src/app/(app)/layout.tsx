import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { ClipzyLogo } from "@/components/logo";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface/70 backdrop-blur md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-6 p-4 md:p-5">
          <Link href="/brands" className="self-start rounded-lg px-1 pt-1 focus-visible:outline-2 focus-visible:outline-accent" aria-label="Clipzy — strona główna">
            <ClipzyLogo height={30} />
          </Link>
          <NavLinks />
          <div className="mt-auto hidden rounded-2xl border border-border bg-surface-2/60 p-3 text-xs md:block">
            <div className="truncate text-muted" title={user.email ?? undefined}>{user.email}</div>
            <form action={signOut} className="mt-1.5">
              <button className="font-semibold text-faint hover:text-text">Wyloguj się</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
