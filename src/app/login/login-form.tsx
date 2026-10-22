"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";
import { Button, Card, Input, Label, Notice, Spinner } from "@/components/ui";

export function LoginForm() {
  const [mode, setMode] = useState<AuthState["mode"]>("login");
  const [state, formAction, pending] = useActionState(authenticate, { mode: "login" } as AuthState);

  const activeMode = mode;

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="mode" value={activeMode} />
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Hasło</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete={activeMode === "signup" ? "new-password" : "current-password"}
            required
          />
        </div>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        {state.info ? <Notice tone="ok">{state.info}</Notice> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          {activeMode === "signup" ? "Załóż konto" : "Zaloguj się"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {activeMode === "signup" ? "Masz już konto?" : "Nie masz konta?"}{" "}
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => setMode(activeMode === "signup" ? "login" : "signup")}
        >
          {activeMode === "signup" ? "Zaloguj się" : "Załóż konto"}
        </button>
      </p>
    </Card>
  );
}
