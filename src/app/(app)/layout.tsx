import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser();
  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
