import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth";
import { buttonClass } from "@/components/ui";
import { InstallAppButton } from "./InstallAppButton";

const navLink =
  "rounded-[var(--radius-control)] px-3 py-2 text-fg-muted transition-colors hover:text-fg";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="page flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Screening Room home">
          <Lamp />
          <span className="font-display text-[18px] font-semibold text-fg">
            Screening Room
          </span>
        </Link>

        <div className="flex items-center gap-1 text-sm">
          <InstallAppButton />
          <Suspense fallback={<span className="ml-1 inline-block h-8 w-[72px]" aria-hidden />}>
            <AccountNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AccountNav() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <Link
        href="/login"
        className={`ml-1 !h-9 ${buttonClass("outline")}`}
      >
        Sign in
      </Link>
    );
  }

  return (
    <>
      <form action="/auth/signout" method="post" className="ml-1 flex items-center gap-2">
        <span
          title={viewer.email}
          className="grid size-8 place-items-center rounded-full bg-raised text-xs font-semibold uppercase text-fg"
        >
          {viewer.email.slice(0, 1)}
        </span>
        <button type="submit" className={navLink}>
          Sign out
        </button>
      </form>
    </>
  );
}

function Lamp() {
  return (
    <span aria-hidden className="relative grid size-5 place-items-center">
      <span className="absolute size-5 rounded-full bg-accent-soft" />
      <span className="size-2 rounded-full bg-accent shadow-[0_0_10px_2px_#eaa64a66]" />
    </span>
  );
}
