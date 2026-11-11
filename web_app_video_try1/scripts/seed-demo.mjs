// Demo data: fake channels with videos, fake viewers, and 28 days of engagement
// (views, likes, comments, subscriptions), including on YOUR channel so the
// Studio analytics have something to show.
//
//   node --env-file=.env.local scripts/seed-demo.mjs          # create (idempotent-ish: skips existing demo users)
//   node --env-file=.env.local scripts/seed-demo.mjs --clean  # remove everything this script created
//
// Everything is tagged: demo users use @demo.screeningroom.test emails, demo
// videos live in ImageKit /videos/demo, and seeded views use "demo-" viewer keys.
// Uses SUPABASE_SERVICE_ROLE_KEY and IMAGEKIT_PRIVATE_KEY from .env.local.

import ImageKit from "@imagekit/nodejs";
import { createClient } from "@supabase/supabase-js";

const DOMAIN = "demo.screeningroom.test";
const IK_FOLDER = "/videos/demo";
const DAYS = 28;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ik = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY });

const SMALL = "https://ik.imagekit.io/demo/sample-video.mp4"; // ~1 MB
const LARGE = "https://ik.imagekit.io/ikmedia/example_video.mp4"; // ~20 MB

const CHANNELS = [
  {
    slug: "northerly",
    name: "Northerly",
    videos: [
      ["A lighthouse keeper’s last winter", LARGE, "Six weeks on a rock in the North Sea, filmed on one camera and a tripod."],
      ["Sunrise timelapse, uncut", SMALL, "Forty minutes compressed into a few seconds. No music."],
      ["Packing for the coast", SMALL, ""],
    ],
  },
  {
    slug: "room-tone",
    name: "Room Tone",
    videos: [
      ["Field recording kit, explained", SMALL, "Every piece of gear in the bag and why it’s there."],
      ["Sound design from scratch", LARGE, "Building the soundscape for a two-minute short, layer by layer."],
    ],
  },
  {
    slug: "vantage",
    name: "Vantage",
    videos: [
      ["Three lenses, one street", SMALL, "Same corner, same light, 24mm vs 50mm vs 85mm."],
      ["Archive: first short film, restored", LARGE, "Scanned from the original tape and graded again."],
      ["Night walk, handheld", SMALL, ""],
    ],
  },
  {
    slug: "cutting-room",
    name: "Cutting Room",
    videos: [
      ["Pacing a two-minute short", SMALL, "Where to cut, where to hold, and why the first version was too long."],
      ["Colour grading on a laptop", LARGE, "A full grade start to finish without a control surface."],
    ],
  },
];

const VIEWERS = ["ava", "ben", "chloe", "dan", "eli", "fern", "gus", "hana", "ivo", "june"];

const COMMENTS = [
  "This is beautifully shot.",
  "The sound at the start gave me chills.",
  "How long did this take to film?",
  "Watched it twice. The ending lands.",
  "What camera was this on?",
  "More of these please.",
  "The pacing in the middle section is perfect.",
  "Saving this for later.",
  "Love the colour in the last shot.",
  "Subscribed after this one.",
];

/** Tell the running app to drop its cached catalog so new data shows immediately. */
async function revalidateSite() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "" },
    });
    console.log(res.ok ? "Site cache refreshed." : `Site cache not refreshed (${res.status}); it updates within an hour.`);
  } catch {
    console.log("App not running; the site cache will refresh on its own.");
  }
}

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const daysAgo = (d) => new Date(Date.now() - d * 86400_000);
const isoDay = (date) => date.toISOString().slice(0, 10);
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

async function listDemoUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  return users;
}

async function ensureUser(slug, displayName) {
  const email = `${slug}@${DOMAIN}`;
  const existing = (await listDemoUsers()).find((u) => u.email === email);
  const user =
    existing ??
    must(await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { demo: true } }), `create ${email}`)
      .user;
  must(await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id), "profile name");
  return user;
}

async function clean() {
  console.log("Removing demo data…");
  // Seeded anonymous views on real videos.
  must(await supabase.from("video_views").delete().like("viewer_key", "demo-%"), "delete demo views");
  // Demo users cascade to their profiles, channels, videos, comments, reactions, subscriptions.
  for (const user of await listDemoUsers()) {
    must(await supabase.auth.admin.deleteUser(user.id), `delete ${user.email}`);
    console.log(`  deleted ${user.email}`);
  }
  // Demo video files in ImageKit.
  try {
    const files = await ik.assets.list({ path: IK_FOLDER, limit: 1000 });
    for (const f of files) if (f.fileId) await ik.files.delete(f.fileId);
    console.log(`  deleted ${files.length} ImageKit files in ${IK_FOLDER}`);
  } catch (err) {
    console.log(`  ImageKit cleanup skipped: ${err.message}`);
  }
  await recomputeViewCounts();
  await revalidateSite();
  console.log("Done.");
}

/** video_stats.views mirrors the deduplicated video_views rows. */
async function recomputeViewCounts() {
  const videos = must(await supabase.from("videos").select("id"), "list videos");
  for (const { id } of videos) {
    const { data: rows } = await supabase.from("video_views").select("watched_seconds").eq("video_id", id);
    const views = rows?.length ?? 0;
    const watch = (rows ?? []).reduce((sum, r) => sum + (r.watched_seconds ?? 0), 0);
    must(await supabase.from("video_stats").update({ views, watch_seconds: watch }).eq("video_id", id), "update views");
  }
}

async function seed() {
  const existing = await listDemoUsers();
  if (existing.length) {
    console.log(`Demo data already exists (${existing.length} demo users). Run with --clean first to start over.`);
    await revalidateSite();
    return;
  }

  // Your channel (the real creator), so analytics show data there too.
  const { data: owners } = await supabase.from("channels").select("id, name").limit(10);
  const realChannels = owners ?? [];

  // 1. Demo creators, channels and videos.
  const demoVideos = [];
  for (const ch of CHANNELS) {
    const owner = await ensureUser(ch.slug, ch.name);
    must(await supabase.from("profiles").update({ role: "creator" }).eq("id", owner.id), "promote demo creator");
    const channel = must(
      await supabase.from("channels").insert({ owner_id: owner.id, name: ch.name, handle: ch.slug }).select("id").single(),
      `channel ${ch.name}`,
    );
    for (const [i, [title, source, description]] of ch.videos.entries()) {
      const fileName = `${ch.slug}-${i + 1}.mp4`;
      process.stdout.write(`  uploading ${fileName}… `);
      const up = await ik.files.upload({ file: source, fileName, folder: IK_FOLDER, useUniqueFileName: false, overwriteFile: true });
      console.log("ok");
      const published = daysAgo(1 + rand(DAYS - 2));
      const video = must(
        await supabase
          .from("videos")
          .insert({
            channel_id: channel.id,
            title,
            description,
            ik_file_id: up.fileId,
            ik_file_path: up.filePath,
            ik_url: up.url,
            duration_seconds: up.duration ?? (source === LARGE ? 63 : 6),
            thumbnail_offset: rand(5),
            is_published: true,
            is_members_only: Math.random() < 0.15,
            published_at: published.toISOString(),
          })
          .select("id, channel_id, published_at")
          .single(),
        `video ${title}`,
      );
      demoVideos.push(video);
    }
    console.log(`Channel ${ch.name}: ${ch.videos.length} videos`);
  }

  // 2. Demo viewers.
  const viewers = [];
  for (const slug of VIEWERS) viewers.push(await ensureUser(slug, slug[0].toUpperCase() + slug.slice(1)));
  console.log(`Viewers: ${viewers.length}`);

  // All published videos, including yours.
  const allVideos = must(
    await supabase.from("videos").select("id, channel_id, published_at, duration_seconds").eq("is_published", true),
    "list published",
  );
  const allChannelIds = [...new Set(allVideos.map((v) => v.channel_id))];

  // 3. Subscriptions, spread over the last 28 days (your channel included).
  const subs = [];
  for (const viewer of viewers) {
    for (const channelId of allChannelIds) {
      if (Math.random() < 0.55) subs.push({ channel_id: channelId, user_id: viewer.id, created_at: daysAgo(rand(DAYS)).toISOString() });
    }
  }
  must(await supabase.from("subscriptions").insert(subs), "subscriptions");
  console.log(`Subscriptions: ${subs.length}`);

  // 4. Views: anonymous "demo-" keys, one per viewer per video per day, since publish.
  const views = [];
  for (const video of allVideos) {
    const since = Math.min(DAYS - 1, Math.floor((Date.now() - new Date(video.published_at ?? Date.now()).getTime()) / 86400_000));
    const popularity = 2 + rand(14);
    for (let d = 0; d <= since; d++) {
      const n = Math.max(0, Math.round(popularity * Math.exp(-d / 9) * (0.6 + Math.random())));
      const dur = Number(video.duration_seconds) || 6;
      for (let k = 0; k < n; k++) {
        const frac = Math.min(1, Math.max(0.08, 0.25 + Math.random() * 0.85));
        views.push({
          video_id: video.id,
          viewer_key: `demo-${rand(1e9)}`,
          day: isoDay(daysAgo(d)),
          max_position: Math.round(dur * frac * 10) / 10,
          watched_seconds: Math.max(1, Math.round(dur * frac * (0.9 + Math.random() * 0.3))),
        });
      }
    }
  }
  for (let i = 0; i < views.length; i += 500) must(await supabase.from("video_views").insert(views.slice(i, i + 500)), "views");
  await recomputeViewCounts();
  console.log(`Views: ${views.length}`);

  // 5. Likes / dislikes and comments from demo viewers.
  const reactions = [];
  const comments = [];
  for (const video of allVideos) {
    for (const viewer of viewers) {
      const r = Math.random();
      if (r < 0.45) reactions.push({ video_id: video.id, user_id: viewer.id, value: 1 });
      else if (r < 0.52) reactions.push({ video_id: video.id, user_id: viewer.id, value: -1 });
      if (Math.random() < 0.18) {
        comments.push({ video_id: video.id, user_id: viewer.id, body: pick(COMMENTS), created_at: daysAgo(rand(10)).toISOString() });
      }
    }
  }
  must(await supabase.from("video_reactions").insert(reactions), "reactions");
  must(await supabase.from("comments").insert(comments), "comments");
  console.log(`Reactions: ${reactions.length}, comments: ${comments.length}`);
  await revalidateSite();

  console.log(`\nDone. Your channel(s): ${realChannels.map((c) => c.name).join(", ") || "none"} now have demo engagement too.`);
  console.log("Remove it all with: node --env-file=.env.local scripts/seed-demo.mjs --clean");
}

(process.argv.includes("--clean") ? clean() : seed()).catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
