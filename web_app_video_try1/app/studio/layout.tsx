import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioNav } from "./StudioNav";

export const metadata: Metadata = { title: { default: "Studio", template: "%s | Studio" } };

/**
 * The layout stays free of session reads so every studio page can prerender its
 * shell (instant navigation). Each page wraps its content in <StudioGate>, which
 * does the creator check behind its own Suspense boundary.
 */
export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-16 sm:px-6">
      <Suspense fallback={<StudioNav activePath={null} />}>
        <StudioNav />
      </Suspense>
      {children}
    </div>
  );
}
