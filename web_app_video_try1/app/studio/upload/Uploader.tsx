"use client";

import {
  ImageKitAbortError,
  ImageKitInvalidRequestError,
  ImageKitServerError,
  ImageKitUploadNetworkError,
  upload,
} from "@imagekit/next";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { IMAGEKIT_PUBLIC_KEY, VIDEO_FOLDER } from "@/lib/env";
import { createVideo } from "../actions";
import { buttonClass } from "@/components/ui";

type Status = "queued" | "uploading" | "saving" | "done" | "cancelled" | "error";

type Item = {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
  controller?: AbortController;
};

const MAX_PARALLEL = 2;

function describeError(error: unknown) {
  if (error instanceof ImageKitAbortError) return "Cancelled";
  if (error instanceof ImageKitInvalidRequestError) return `ImageKit rejected the file: ${error.message}`;
  if (error instanceof ImageKitUploadNetworkError) return "Network error. Check your connection and retry.";
  if (error instanceof ImageKitServerError) return "ImageKit had a problem. Retry in a moment.";
  return error instanceof Error ? error.message : "Upload failed.";
}

function formatSize(bytes: number) {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(1)} MB`;
}

export function Uploader() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useRef(0);
  const queue = useRef<Item[]>([]);

  const patch = useCallback((id: string, changes: Partial<Item>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const uploadOne = useCallback(
    async (item: Item) => {
      const controller = new AbortController();
      patch(item.id, { status: "uploading", controller, progress: 0 });
      try {
        const authRes = await fetch("/api/imagekit/auth", { method: "POST" });
        if (!authRes.ok) throw new Error((await authRes.json()).error ?? "Not allowed to upload.");
        const auth = await authRes.json();

        const result = await upload({
          file: item.file,
          fileName: item.file.name,
          folder: VIDEO_FOLDER,
          useUniqueFileName: true,
          publicKey: IMAGEKIT_PUBLIC_KEY,
          token: auth.token,
          signature: auth.signature,
          expire: auth.expire,
          abortSignal: controller.signal,
          onProgress: (event) => {
            if (event.lengthComputable) patch(item.id, { progress: event.loaded / event.total });
          },
        });

        patch(item.id, { status: "saving", progress: 1 });
        const saved = await createVideo({
          fileId: result.fileId!,
          filePath: result.filePath!,
          url: result.url!,
          name: item.file.name,
          duration: result.duration ?? null,
        });
        if (!saved.ok) throw new Error(saved.error);
        patch(item.id, { status: "done", controller: undefined });
      } catch (error) {
        const cancelled = error instanceof ImageKitAbortError;
        patch(item.id, {
          status: cancelled ? "cancelled" : "error",
          error: cancelled ? undefined : describeError(error),
          controller: undefined,
        });
      }
    },
    [patch],
  );

  const runNext = useCallback(
    function pump() {
      while (active.current < MAX_PARALLEL && queue.current.length) {
        const item = queue.current.shift()!;
        active.current += 1;
        void uploadOne(item).finally(() => {
          active.current -= 1;
          pump();
        });
      }
    },
    [uploadOne],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const videos = Array.from(files).filter((file) => file.type.startsWith("video/"));
      if (!videos.length) return;
      const next = videos.map<Item>((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "queued",
      }));
      setItems((prev) => [...next, ...prev]);
      queue.current.push(...next);
      runNext();
    },
    [runNext],
  );

  function cancel(item: Item) {
    if (item.status === "queued") {
      queue.current = queue.current.filter((q) => q.id !== item.id);
      patch(item.id, { status: "cancelled" });
    } else {
      item.controller?.abort();
    }
  }

  function retry(item: Item) {
    const fresh = { ...item, status: "queued" as const, progress: 0, error: undefined };
    patch(item.id, fresh);
    queue.current.push(fresh);
    runNext();
  }

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="mt-6 space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-[var(--radius-thumb)] border border-dashed px-6 py-16 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-surface/60"
        }`}
      >
        <p className="type-heading">Drop video files here</p>
        <p className="mt-1 text-sm text-fg-muted">MP4, MOV, WebM and other video formats. Several at once is fine.</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`mt-5 ${buttonClass("outline")}`}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Uploads">
          {items.map((item) => (
            <UploadRow key={item.id} item={item} onCancel={() => cancel(item)} onRetry={() => retry(item)} />
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <p className="text-sm text-fg-muted">
          {doneCount} {doneCount === 1 ? "video is" : "videos are"} in your library.{" "}
          <Link href="/studio" className="font-medium text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
            Go to videos
          </Link>
        </p>
      )}
    </div>
  );
}

function UploadRow({ item, onCancel, onRetry }: { item: Item; onCancel: () => void; onRetry: () => void }) {
  const percent = Math.round(item.progress * 100);
  const label: Record<Status, string> = {
    queued: "Waiting",
    uploading: `${percent}%`,
    saving: "Saving",
    done: "Uploaded",
    cancelled: "Cancelled",
    error: "Failed",
  };
  const canCancel = item.status === "queued" || item.status === "uploading";
  const canRetry = item.status === "error" || item.status === "cancelled";

  return (
    <li className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <p className="text-xs text-fg-muted">
            {formatSize(item.file.size)}
            {item.error ? ` | ${item.error}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className={item.status === "error" ? "text-danger" : item.status === "done" ? "text-fg" : "text-fg-muted"}>
            {label[item.status]}
          </span>
          {canCancel && (
            <button type="button" onClick={onCancel} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              Cancel
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={onRetry} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
              Retry
            </button>
          )}
        </div>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-label={`Upload progress for ${item.file.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${item.status === "error" ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${item.status === "queued" ? 0 : percent}%` }}
        />
      </div>
    </li>
  );
}
