import { ClipzyLogo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <ClipzyLogo variant="stacked" height={96} />
          <p className="mt-5 text-sm text-muted">Wiele ujęć, jedna reklama, która sprzedaje.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
