"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/actions/auth";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={action} className="card card-pad w-full max-w-sm">
      <h1 className="h1 mb-1">C.A.G. Dispatch</h1>
      <p className="muted mb-4 text-sm">Call A Guy Chicago</p>

      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="input"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state.error && (
        <p className="mb-3 border border-[var(--color-danger)] bg-red-50 px-2 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
