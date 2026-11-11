"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * "Install app" next to the account controls. Uses the browser's real install
 * prompt when offered (Chrome/Edge on HTTPS or localhost); otherwise shows the
 * steps for this device. Hidden when already running as the installed app.
 */
export function InstallAppButton() {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Browser-only checks run after mount so server and client markup match.
    /* eslint-disable react-hooks/set-state-in-effect -- reading device capabilities once on mount */
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as InstallPromptEvent;
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!ready || installed) return null;

  async function onClick() {
    const prompt = promptRef.current;
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      promptRef.current = null;
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] px-3 text-[14px] font-semibold text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
        </svg>
        <span className="hidden sm:inline">Install app</span>
        <span className="sr-only sm:hidden">Install app</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Install Screening Room"
          className="absolute right-0 top-11 z-50 w-[300px] rounded-[var(--radius-thumb)] border border-line-strong bg-raised p-4 shadow-2xl"
        >
          <p className="type-title">Add Screening Room to your home screen</p>
          <p className="type-meta mt-1 text-fg-muted">It opens full screen, straight into the app.</p>
          <ol className="type-meta mt-3 list-decimal space-y-1.5 pl-5 text-fg">
            {platform === "ios" && (
              <>
                <li>
                  Tap the <strong>Share</strong> button (square with an arrow) in Safari.
                </li>
                <li>
                  Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
                </li>
              </>
            )}
            {platform === "android" && (
              <>
                <li>
                  Tap the <strong>⋮</strong> menu in Chrome.
                </li>
                <li>
                  Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
              </>
            )}
            {platform === "desktop" && (
              <>
                <li>
                  In Chrome or Edge, click the <strong>install icon</strong> at the right end of the address bar.
                </li>
                <li>
                  Or open the browser menu and choose <strong>Install Screening Room</strong>.
                </li>
              </>
            )}
          </ol>
          {platform === "ios" && <p className="type-meta mt-3 text-fg-faint">Use Safari; other iPhone browsers can’t add apps.</p>}
        </div>
      )}
    </div>
  );
}
