"use client";

import { useState } from "react";
import { Switch } from "@/components/ui";

export function SwitchDemo({ initial, label }: { initial: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center gap-3">
      <Switch checked={on} onChange={setOn} label={label} />
      <span className="type-meta text-fg-muted">{on ? "Live" : "Draft"}</span>
    </div>
  );
}
