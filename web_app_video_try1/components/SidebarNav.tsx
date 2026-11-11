"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode; match: (path: string) => boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const primary: Item[] = [
  { href: "/", label: "Home", icon: icon("M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z"), match: (p) => p === "/" },
  {
    href: "/subscriptions",
    label: "Subscriptions",
    icon: icon("M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm2-3h12M10.5 10.5v5l4-2.5-4-2.5Z"),
    match: (p) => p.startsWith("/subscriptions"),
  },
  { href: "/history", label: "History", icon: icon("M12 7.5V12l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4.5V8H7"), match: (p) => p.startsWith("/history") },
];

const secondary: Item[] = [
  {
    href: "/playlists",
    label: "Playlists",
    icon: icon("M4 6h11M4 11h11M4 16h7M17 13.5v6l4.5-3-4.5-3Z"),
    match: (p) => p.startsWith("/playlists") || p.startsWith("/playlist/"),
  },
];

const studio: Item = {
  href: "/studio",
  label: "Studio",
  icon: icon("M4 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm12 4 5-3v9l-5-3"),
  match: (p) => p.startsWith("/studio"),
};

/** `live` reads the URL for the active state; the Suspense fallback passes false. */
export function SidebarNav({ showStudio, live }: { showStudio: boolean; live: boolean }) {
  return live ? <LiveNav showStudio={showStudio} /> : <Nav pathname="" showStudio={showStudio} />;
}

function LiveNav({ showStudio }: { showStudio: boolean }) {
  return <Nav pathname={usePathname()} showStudio={showStudio} />;
}

function Nav({ pathname, showStudio }: { pathname: string; showStudio: boolean }) {
  const groups = [primary, showStudio ? [...secondary, studio] : secondary];
  return (
    <nav
      aria-label="Main"
      className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-[232px] lg:shrink-0 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:border-b-0 lg:px-3 lg:py-4"
    >
      {groups.map((items, i) => (
        <ul
          key={i}
          className={`flex gap-1 lg:flex-col lg:gap-0.5 ${i > 0 ? "lg:mt-3 lg:border-t lg:border-line lg:pt-3" : ""}`}
        >
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`type-title flex h-10 items-center gap-3.5 whitespace-nowrap rounded-[var(--radius-control)] px-3 transition-colors ${
                    active ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface hover:text-fg"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
