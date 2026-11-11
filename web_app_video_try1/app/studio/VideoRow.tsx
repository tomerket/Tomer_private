"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Switch } from "@/components/ui";
import { setMembersOnly, setPublished } from "./actions";

type RowVideo = {
  id: string;
  title: string;
  duration: string | null;
  isPublished: boolean;
  isMembersOnly: boolean;
  thumb: string;
};

type Flags = { isPublished: boolean; isMembersOnly: boolean };

export function VideoRow({ video }: { video: RowVideo }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic<Flags, Partial<Flags>>(
    { isPublished: video.isPublished, isMembersOnly: video.isMembersOnly },
    (state, change) => ({ ...state, ...change }),
  );

  function toggle(field: "isPublished" | "isMembersOnly", next: boolean) {
    setError(null);
    startTransition(async () => {
      setOptimistic(field === "isPublished" ? { isPublished: next } : { isMembersOnly: next });
      const result = field === "isPublished" ? await setPublished(video.id, next) : await setMembersOnly(video.id, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-line/70 align-middle">
      <td className="py-3 pr-4">
        <Link href={`/studio/videos/${video.id}`} className="group flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit already resizes; see lib/imagekit.server.ts */}
          <img
            src={video.thumb}
            alt=""
            width={128}
            height={72}
            loading="lazy"
            className="aspect-video w-32 shrink-0 rounded-[var(--radius-chip)] bg-raised object-cover"
          />
          <span className="line-clamp-2 font-medium group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
            {video.title}
          </span>
        </Link>
        {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </td>
      <td className="type-timecode py-3 pr-4 text-fg-muted">{video.duration ?? "Processing"}</td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <Switch
            label={optimistic.isPublished ? `Unpublish ${video.title}` : `Publish ${video.title}`}
            checked={optimistic.isPublished}
            disabled={pending}
            onChange={(next) => toggle("isPublished", next)}
          />
          <span className="text-xs text-fg-muted">{optimistic.isPublished ? "Live" : "Draft"}</span>
        </div>
      </td>
      <td className="py-3 pr-4">
        <Switch
          label={`Members only for ${video.title}`}
          checked={optimistic.isMembersOnly}
          disabled={pending}
          onChange={(next) => toggle("isMembersOnly", next)}
        />
      </td>
      <td className="py-3 text-right">
        <Link href={`/studio/videos/${video.id}`} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Edit
        </Link>
      </td>
    </tr>
  );
}
