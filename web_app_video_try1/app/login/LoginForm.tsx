"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "link";
type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const linkError = params.get("error");
  const [mode, setMode] = useState<Mode>("password");
  const [state, setState] = useState<State>(
    linkError ? { kind: "error", message: "That sign-in link has expired or was already used. Sign in with your password or request a new link." } : { kind: "idle" },
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) return;
    setState({ kind: "working" });
    const supabase = createClient();

    if (mode === "password") {
      const password = String(form.get("password") ?? "");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        // Full navigation so the server sees the new session cookies right away.
        window.location.assign(next);
        return;
      }
      setState({
        kind: "error",
        message:
          error.code === "invalid_credentials"
            ? "Wrong email or password. If you haven’t set a password yet, use “Email link” instead."
            : error.message,
      });
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (!error) return setState({ kind: "sent", email });
    const rateLimited = error.code === "over_email_send_rate_limit" || error.status === 429;
    setState({
      kind: "error",
      message: rateLimited
        ? "Too many sign-in emails were sent in the last hour. Sign in with your password instead, or wait about an hour."
        : error.message,
    });
  }

  if (state.kind === "sent") {
    return (
      <div className="mt-8 rounded-[var(--radius-control)] border border-line bg-surface p-4">
        <p className="type-title">Check your email</p>
        <p className="type-meta mt-1 text-fg-muted">
          We sent a sign-in link to {state.email}. Open it on this device to continue.
        </p>
      </div>
    );
  }

  const working = state.kind === "working";

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Sign-in method" className="inline-flex rounded-[var(--radius-pill)] bg-surface p-1">
        {(["password", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setState({ kind: "idle" });
            }}
            className={`type-title h-8 rounded-[var(--radius-pill)] px-4 transition-colors ${
              mode === m ? "bg-raised text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {m === "password" ? "Password" : "Email link"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <label htmlFor="email" className="type-title block">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@example.com" />

        {mode === "password" && (
          <>
            <label htmlFor="password" className="type-title block pt-1">
              Password
            </label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </>
        )}

        {state.kind === "error" && (
          <p role="alert" className="type-meta text-danger">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={working} className={`w-full ${buttonClass("primary")}`}>
          {mode === "password" ? (working ? "Signing in…" : "Sign in") : working ? "Sending link…" : "Email me a sign-in link"}
        </button>

        {mode === "link" && (
          <p className="type-meta text-fg-faint">We’ll email a one-time link. No password needed.</p>
        )}
      </form>
    </div>
  );
}
