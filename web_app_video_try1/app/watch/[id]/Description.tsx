"use client";

import { useState } from "react";

/** The panel under the channel row: "N views · 19 minutes ago", then the description. */
export function Description({ header, text }: { header: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 240 || text.split("\n").length > 3;

  return (
    <div className="mt-5 rounded-[var(--radius-thumb)] border border-line bg-surface px-5 py-4">
      <p className="type-title text-[15px] tabular-nums">{header}</p>
      {text && (
        <p className={`type-body mt-2 whitespace-pre-line text-fg/90 ${!open && long ? "line-clamp-3" : ""}`}>{text}</p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="type-title mt-2 text-fg-muted hover:text-fg"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
