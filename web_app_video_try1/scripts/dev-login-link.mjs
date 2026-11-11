// Development helper: prints a one-time sign-in link without sending an email.
// Useful when Supabase's built-in email sender hits its hourly rate limit.
//
// Usage (from the project root):
//   node --env-file=.env.local scripts/dev-login-link.mjs you@example.com [/next/path]
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local. That key is only read by this
// local script; the app itself never uses it.

import { createClient } from "@supabase/supabase-js";

const [email, next = "/studio"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/dev-login-link.mjs you@example.com [/next/path]");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(`Could not create a link: ${error.message}`);
  process.exit(1);
}

const link = `${site}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
console.log("\nOpen this link in your browser (works once, expires in about an hour):\n");
console.log(link);
console.log("");
