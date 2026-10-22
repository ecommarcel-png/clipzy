import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-6 p-4 md:p-5">
          <Link href="/brands" className="text-xl font-bold tracking-tight">
            clip<span className="text-accent">zy</span>
          </Link>
          <NavLinks />
          <div className="mt-auto hidden space-y-2 border-t border-border pt-4 text-xs text-muted md:block">
            <div className="truncate" title={user.email ?? undefined}>{user.email}</div>
            <form action={signOut}>
              <button className="hover:text-text">Wyloguj się</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
