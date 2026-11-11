import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <section className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm">
        <h1 className="type-display">Sign in</h1>
        <p className="mt-2 type-body text-fg-muted">
          Use your password, or get a one-time sign-in link by email.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
