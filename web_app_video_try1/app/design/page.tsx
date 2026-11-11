import type { Metadata } from "next";
import { ChannelAvatar, LockIcon, TimecodeBadge, VideoCard } from "@/components/VideoCard";
import { buttonClass, inputClass } from "@/components/ui";
import type { CardVideo } from "@/lib/catalog";
import { thumbSet } from "@/lib/imagekit.server";
import { SwitchDemo } from "./Demos";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Frames from the sample video in the ImageKit library (6 seconds long). */
const SAMPLE = "/sample-video.mp4";

type Sample = Omit<CardVideo, "id" | "thumb" | "channel" | "views"> & { channel: string };

const sampleViews = [241_000, 18_400, 96_200, 1_250_000, 7_310, 52_800, 3_904, 128_000, 2_210, 61_700, 880, 0];

const samples: Sample[] = [
  { title: "A lighthouse keeper’s last winter", duration: "18:42", isMembersOnly: false, published: "3 days ago", channel: "Northerly" },
  { title: "Colour grading the final cut", duration: "22:41", isMembersOnly: true, published: "5 days ago", channel: "Tomer Ket" },
  { title: "Field recording kit, packed and explained in under ten minutes for anyone starting out with location sound", duration: "9:57", isMembersOnly: false, published: "1 week ago", channel: "Room Tone" },
  { title: "Storyboard to screen", duration: "1:02:19", isMembersOnly: false, published: "2 weeks ago", channel: "Tomer Ket" },
  { title: "Rough cut review with notes", duration: "38:12", isMembersOnly: true, published: "2 weeks ago", channel: "Tomer Ket" },
  { title: "Sunrise timelapse, uncut", duration: "6:30", isMembersOnly: false, published: "3 weeks ago", channel: "Northerly" },
  { title: "Three lenses, one street", duration: "11:45", isMembersOnly: false, published: "3 weeks ago", channel: "Vantage" },
  { title: "Behind the edit: pacing a two-minute short", duration: "17:03", isMembersOnly: false, published: "1 month ago", channel: "Tomer Ket" },
  { title: "Members Q&A, October", duration: "48:26", isMembersOnly: true, published: "1 month ago", channel: "Tomer Ket" },
  { title: "Sound design from scratch", duration: "25:10", isMembersOnly: false, published: "1 month ago", channel: "Room Tone" },
  { title: "Archive: first short film, restored", duration: "8:44", isMembersOnly: false, published: "2 months ago", channel: "Vantage" },
  { title: "Uploading now", duration: null, isMembersOnly: false, published: null, channel: "Tomer Ket" },
];

function sampleCards(): CardVideo[] {
  return samples.map((s, i) => ({
    ...s,
    id: `sample-${i}`,
    views: sampleViews[i] ?? 0,
    channel: { name: s.channel, handle: s.channel.toLowerCase() },
    thumb: thumbSet(SAMPLE, i % 6),
  }));
}

const colors = [
  { token: "canvas", hex: "#0A0A0B", role: "Page background" },
  { token: "surface", hex: "#141416", role: "Panels, fields, avatars" },
  { token: "raised", hex: "#1C1C1F", role: "Hover fills, image wells" },
  { token: "line", hex: "#26262A", role: "Hairline borders" },
  { token: "fg", hex: "#F4F4F5", role: "Primary text", contrast: "18.0:1" },
  { token: "fg-muted", hex: "#A6A6AE", role: "Channel, secondary", contrast: "8.2:1" },
  { token: "fg-faint", hex: "#7D7D86", role: "Meta, hints", contrast: "4.9:1" },
  { token: "accent", hex: "#EAA64A", role: "Live, playing, yours", contrast: "9.5:1" },
];

const faces = [
  { name: "Space Grotesk", role: "Display", sample: "Aa Gg 24", cls: "font-grotesk" },
  { name: "Inter Tight", role: "Interface", sample: "Aa Gg 24", cls: "font-sans" },
  { name: "Space Mono", role: "Data · timecode", sample: "0:00 24", cls: "font-mono" },
];

const scale = [
  { label: "Display XL", cls: "type-display-xl", sample: "Everything worth watching", spec: "Space Grotesk · 700 · 56 · −3% · 0.98" },
  { label: "Display", cls: "type-display", sample: "Latest from the studio", spec: "Space Grotesk · 500 · 30 · −2%" },
  { label: "Heading", cls: "type-heading", sample: "Up next", spec: "Inter Tight · 600 · 20 · −1.2%" },
  { label: "Card title", cls: "type-title", sample: "A lighthouse keeper’s last winter", spec: "Inter Tight · 500 · 14 · −0.6%" },
  { label: "Body", cls: "type-body", sample: "A restrained warm signal marks what is live, playing, or yours.", spec: "Inter Tight · 400 · 15" },
  { label: "Meta", cls: "type-meta text-fg-faint", sample: "241K views · 3 days ago", spec: "Inter Tight · 400 · 13 · tabular" },
  { label: "Label", cls: "type-label text-fg-muted", sample: "Up next", spec: "Inter Tight · 600 · 11 · +12% · caps" },
  { label: "Timecode", cls: "type-timecode", sample: "1:54:20", spec: "Space Mono · 400 · 12 · tabular" },
];

const anatomy = [
  ["Image", "16:9, radius 10px, object-cover, 1px hairline border (white 7%)"],
  ["Hover", "Image eases in to 103% over 500ms; channel turns muted → white"],
  ["Timecode badge", "Space Mono 12px, black/75 + blur, bottom-right 8px, 4px radius"],
  ["Playhead", "3px amber bar with glow along the bottom edge"],
  ["Hover scrub", "Playhead eases to 32% on hover"],
  ["Title", "Inter Tight 14px / 500, clamp 2 lines, −0.6% tracking"],
  ["Channel", "Inter Tight 13px, muted → white on hover"],
  ["Meta", "Inter Tight 13px, faint, tabular figures: “241K views · 3 days ago”; lock first when members-only"],
  ["Avatar", "36px circle, initial, surface fill → raised on hover"],
  ["Rhythm", "12px image → text, 12px avatar gap, 4px title → channel"],
];

function Section({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="py-14">
      <div className="mb-10 flex gap-4">
        <span className="type-timecode pt-[7px] text-accent">{n}</span>
        <div className="max-w-2xl">
          <h2 className="type-heading">{title}</h2>
          {note && <p className="type-body mt-1.5 text-fg-muted">{note}</p>}
        </div>
      </div>
      <div className="sm:pl-10">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="type-label mb-4 text-fg-faint">{children}</p>;
}

export default function DesignPage() {
  const cards = sampleCards();

  return (
    <div className="page pb-24 pt-14">
      <header className="max-w-4xl pb-6">
        <p className="type-label text-fg-faint">Screening Room · Design system</p>
        <h1 className="type-display-xl mt-4">Everything worth watching</h1>
        <p className="type-body mt-5 max-w-xl text-fg-muted">
          Near-black, white type set tight, and one warm signal for what is live, playing, or yours. The thumbnails
          carry the colour; the interface stays out of their way.
        </p>
      </header>

      <Section n="01" title="Color" note="Depth comes from surface steps, not shadows. Contrast is measured against the canvas.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {colors.map((c) => (
            <div key={c.token}>
              <div
                className="aspect-[4/3] rounded-[var(--radius-control)] ring-1 ring-inset ring-white/[0.07]"
                style={{ background: c.hex }}
              />
              <p className="type-title mt-3">{c.token}</p>
              <p className="type-timecode mt-0.5 text-fg-muted">
                {c.hex}
                {c.contrast ? ` ${c.contrast}` : ""}
              </p>
              <p className="type-meta mt-0.5 text-fg-faint">{c.role}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        n="02"
        title="Typography"
        note="Space Grotesk holds the display voice in reserve; Inter Tight carries the dense interface; Space Mono gives durations and counts a timecode readout."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {faces.map((f) => (
            <div key={f.name} className="rounded-[var(--radius-thumb)] border border-line bg-surface/60 px-6 py-5">
              <p className={`${f.cls} text-[44px] leading-none tracking-[-0.02em]`}>{f.sample}</p>
              <p className="type-title mt-5">{f.name}</p>
              <p className="type-label mt-1 text-fg-faint">{f.role}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 divide-y divide-line rounded-[var(--radius-thumb)] border border-line">
          {scale.map((t) => (
            <div key={t.label} className="grid items-center gap-2 px-6 py-5 md:grid-cols-[140px_minmax(0,1fr)_auto] md:gap-8">
              <p className="type-label text-fg-faint">{t.label}</p>
              <p className={`${t.cls} truncate`}>{t.sample}</p>
              <p className="type-timecode text-[11px] text-fg-faint">{t.spec}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        n="03"
        title="The thumbnail card"
        note="16:9 image, a mono timecode badge, a two-line title, and a meta line. The only amber is the playhead, a scrub nudge on hover."
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <div>
            <VideoCard video={cards[0]} href="#" priority />
            <p className="type-meta mt-4 text-fg-faint">Hover the card: the image eases in and the playhead nudges along the bottom.</p>
          </div>
          <div>
            <Label>Anatomy</Label>
            <dl className="divide-y divide-line rounded-[var(--radius-thumb)] border border-line">
              {anatomy.map(([term, detail]) => (
                <div key={term} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                  <dt className="type-meta text-fg-muted">{term}</dt>
                  <dd className="type-meta text-fg">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-14">
          <Label>States</Label>
          <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { card: cards[6], hover: false, note: "Default" },
              { card: cards[7], hover: true, note: "Hover" },
              { card: cards[1], hover: false, note: "Members only" },
              { card: cards[11], hover: false, note: "Just uploaded, length pending" },
            ].map(({ card, hover, note }) => (
              <div key={card.id}>
                <VideoCard video={card} href="#" forceHover={hover} />
                <p className="type-label mt-4 text-fg-faint">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        n="04"
        title="Home feed"
        note="One column on phones, then 2, 3, 4, 5 and 6 at 520, 840, 1120, 1440 and 1800px. 16px between columns, 36px between rows, gutters 16 → 24 → 32px. Resize the window to see it step."
      >
        <div className="video-grid">
          {cards.map((card, i) => (
            <VideoCard key={card.id} video={card} href="#" priority={i < 6} />
          ))}
        </div>
      </Section>

      <Section n="05" title="Controls" note="Amber earns its place on exactly one action per view: the primary one.">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-10">
            <div>
              <Label>Buttons</Label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={buttonClass("primary")}>Upload</button>
                <button type="button" className={buttonClass("strong")}>Publish</button>
                <button type="button" className={buttonClass("outline")}>Published</button>
                <button type="button" className={buttonClass("ghost")}>Edit</button>
              </div>
            </div>
            <div>
              <Label>Badges</Label>
              <div className="flex flex-wrap items-center gap-4">
                <span className="relative h-7 w-[72px]">
                  <TimecodeBadge duration="12:04" />
                </span>
                <span className="type-label inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-black/75 px-2 py-1 text-fg">
                  <span className="size-1.5 rounded-full bg-accent shadow-[0_0_6px_1px_#eaa64a99]" />
                  Live
                </span>
                <span className="type-label inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-black/75 px-2 py-1 text-fg">
                  <LockIcon className="size-2.5" />
                  Members
                </span>
                <span className="type-label text-fg-faint">Draft</span>
              </div>
            </div>
            <div>
              <Label>Switches</Label>
              <div className="flex flex-wrap gap-8">
                <SwitchDemo initial label="Published" />
                <SwitchDemo initial={false} label="Members only" />
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <Label>Field</Label>
              <label htmlFor="ds-input" className="sr-only">
                Video title
              </label>
              <input id="ds-input" className={inputClass} placeholder="Video title" />
            </div>
            <div>
              <Label>Avatars</Label>
              <div className="flex items-end gap-4">
                <ChannelAvatar name="Northerly" size="size-7" />
                <ChannelAvatar name="Vantage" size="size-9" />
                <ChannelAvatar name="Screening" size="size-14 text-[18px]" />
              </div>
            </div>
            <div>
              <Label>Progress</Label>
              <div className="type-meta mb-2 flex justify-between text-fg-muted">
                <span>harbour-night.mov</span>
                <span className="type-timecode">64%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-raised">
                <div className="h-full w-[64%] rounded-full bg-accent" />
              </div>
            </div>
          </div>
        </div>
        <p className="type-meta mt-10 text-fg-faint">Press Tab to see the amber focus ring on every control.</p>
      </Section>
    </div>
  );
}
