"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/studio", label: "Videos", match: (p: string) => p === "/studio" || p.startsWith("/studio/videos") },
  { href: "/studio/upload", label: "Upload", match: (p: string) => p.startsWith("/studio/upload") },
  { href: "/studio/playlists", label: "Playlists", match: (p: string) => p.startsWith("/studio/playlists") },
  { href: "/studio/analytics", label: "Analytics", match: (p: string) => p.startsWith("/studio/analytics") },
];

export function StudioNav({ activePath }: { activePath?: string | null }) {
  return activePath === undefined ? <LiveStudioNav /> : <StudioTabs pathname={activePath ?? ""} />;
}

function LiveStudioNav() {
  return <StudioTabs pathname={usePathname()} />;
}

function StudioTabs({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Studio" className="flex gap-1 border-b border-line pt-4 text-sm">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 pb-3 pt-1 transition-colors ${
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
