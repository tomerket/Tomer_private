import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="type-display">This page isn’t here</h1>
      <p className="mt-3 max-w-md type-body text-fg-muted">
        The link may be wrong, or the video was unpublished.
      </p>
      <Link
        href="/"
        className={`mt-8 ${buttonClass("outline")}`}
      >
        Back to all videos
      </Link>
    </section>
  );
}
