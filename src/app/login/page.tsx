import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight">
            clip<span className="text-accent">zy</span>
          </div>
          <p className="mt-2 text-sm text-muted">Sklejki, AI nagrania i image ads pod Meta Ads.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
