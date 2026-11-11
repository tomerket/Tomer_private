"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { addComment, deleteComment, recordView, setReaction, setSubscribed, type EngageResult } from "../actions";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function useSignInRedirect(returnTo: string) {
  const router = useRouter();
  return (result: EngageResult) => {
    if (!result.ok && result.needsSignIn) router.push(`/login?next=${encodeURIComponent(returnTo)}`);
  };
}

/** Counts the view once the page is open (deduplicated per viewer per day). */
export function ViewTracker({ videoId }: { videoId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordView(videoId);
  }, [videoId]);
  return null;
}

export function SubscribeButton({
  channelId,
  subscribed,
  returnTo,
}: {
  channelId: string;
  subscribed: boolean;
  returnTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(subscribed);
  const handle = useSignInRedirect(returnTo);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          handle(await setSubscribed(channelId, !optimistic));
        })
      }
      className={buttonClass(optimistic ? "outline" : "strong")}
    >
      {optimistic ? "Subscribed" : "Subscribe"}
    </button>
  );
}

type Reaction = 1 | -1 | 0;

export function ReactionPill({
  videoId,
  mine,
  likes,
  dislikes,
  returnTo,
}: {
  videoId: string;
  mine: Reaction;
  likes: number;
  dislikes: number;
  returnTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic({ mine, likes, dislikes });
  const handle = useSignInRedirect(returnTo);

  function choose(value: 1 | -1) {
    const next: Reaction = state.mine === value ? 0 : value;
    startTransition(async () => {
      setState({
        mine: next,
        likes: state.likes - (state.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
        dislikes: state.dislikes - (state.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
      });
      handle(await setReaction(videoId, next));
    });
  }

  const item = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 px-4 type-title tabular-nums transition-colors disabled:opacity-60 ${
      active ? "text-accent" : "text-fg hover:bg-raised"
    }`;

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-pill)] bg-surface">
      <button type="button" disabled={pending} aria-pressed={state.mine === 1} aria-label="Like" onClick={() => choose(1)} className={item(state.mine === 1)}>
        <ThumbIcon filled={state.mine === 1} />
        {compact.format(state.likes)}
      </button>
      <span aria-hidden className="my-2.5 w-px bg-line-strong" />
      <button type="button" disabled={pending} aria-pressed={state.mine === -1} aria-label="Dislike" onClick={() => choose(-1)} className={item(state.mine === -1)}>
        <ThumbIcon filled={state.mine === -1} down />
        {compact.format(state.dislikes)}
      </button>
    </div>
  );
}

function ThumbIcon({ filled, down }: { filled?: boolean; down?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-[18px] ${down ? "rotate-180" : ""}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7.5a2 2 0 0 1 2.9.9c.3.7.3 1.5.1 2.2L13 9h6.3a2 2 0 0 1 2 2.3l-1.2 8a2 2 0 0 1-2 1.7H7" />
    </svg>
  );
}

export function CommentForm({ videoId, signedIn, returnTo }: { videoId: string; signedIn: boolean; returnTo: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const handle = useSignInRedirect(returnTo);
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addComment(videoId, text);
      if (result.ok) setText("");
      else {
        setError(result.error);
        handle(result);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="comment" className="sr-only">
          Add a comment
        </label>
        <input
          id="comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => !signedIn && router.push(`/login?next=${encodeURIComponent(returnTo)}`)}
          maxLength={2000}
          placeholder={signedIn ? "Add a comment…" : "Sign in to comment"}
          className="type-body w-full border-b border-line bg-transparent pb-2.5 text-fg placeholder:text-fg-faint focus:border-fg-muted focus:outline-none"
        />
        {error && <p role="alert" className="type-meta mt-2 text-danger">{error}</p>}
      </div>
      <button type="submit" disabled={pending || (signedIn && !text.trim())} className={buttonClass(text.trim() ? "strong" : "ghost")}>
        {pending ? "Posting…" : "Comment"}
      </button>
    </form>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteComment(commentId);
          setError(!result.ok);
        })
      }
      className="type-meta text-fg-faint transition-colors hover:text-danger disabled:opacity-50"
    >
      {pending ? "Deleting…" : error ? "Couldn’t delete" : "Delete"}
    </button>
  );
}
