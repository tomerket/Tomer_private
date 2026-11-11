import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getViewer, type Viewer } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/types";
import { ChannelSetup } from "./ChannelSetup";

export type CreatorContext = { viewer: Viewer; channel: Tables<"channels"> };

/**
 * Wrap every studio page's content in this. The session check streams in behind
 * Suspense, so the page segment itself still has a static shell.
 * `children` is a render function that receives the verified creator + channel.
 */
export function StudioGate({
  children,
  fallback = <StudioSkeleton />,
}: {
  children: (ctx: CreatorContext) => React.ReactNode | Promise<React.ReactNode>;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: (ctx: CreatorContext) => React.ReactNode | Promise<React.ReactNode> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/studio");

  if (!viewer.isCreator) {
    return (
      <section className="py-20">
        <h1 className="type-display">Studio is for the channel owner</h1>
        <p className="mt-2 max-w-lg type-body text-fg-muted">
          You’re signed in as {viewer.email}, which isn’t a creator account. Ask the owner to grant creator access.
        </p>
      </section>
    );
  }

  if (!viewer.channel) return <ChannelSetup />;
  return <>{await children({ viewer, channel: viewer.channel })}</>;
}

export function StudioSkeleton() {
  return (
    <div className="space-y-3 pt-8" aria-hidden>
      <div className="h-8 w-48 rounded-[var(--radius-control)] bg-surface" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-[72px] rounded-[var(--radius-control)] bg-surface/70" />
      ))}
    </div>
  );
}
