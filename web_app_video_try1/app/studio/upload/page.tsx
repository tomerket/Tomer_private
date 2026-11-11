import type { Metadata } from "next";
import { StudioGate } from "../StudioGate";
import { Uploader } from "./Uploader";

export const metadata: Metadata = { title: "Upload" };

export default function UploadPage() {
  return (
    <section className="pt-8">
      <h1 className="type-display">Upload videos</h1>
      <p className="mt-1 type-body text-fg-muted">
        New uploads start unpublished. Give them a title and a thumbnail, then publish when they’re ready.
      </p>
      <StudioGate fallback={<div className="mt-6 h-56 rounded-[var(--radius-thumb)] bg-surface/60" aria-hidden />}>
        {() => <Uploader />}
      </StudioGate>
    </section>
  );
}
