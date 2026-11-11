// Sets (or resets) the password for an existing account, without any email.
// You type the password in your own terminal; it is never printed or stored here.
//
//   node --env-file=.env.local scripts/set-password.mjs you@example.com
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/set-password.mjs you@example.com");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Reads a line without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function findUser(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user || data.users.length < 200) return user ?? null;
  }
}

const user = await findUser(email);
if (!user) {
  console.error(`No account for ${email}. Sign in once with an email link first, or check the spelling.`);
  process.exit(1);
}

const password = await askHidden(`New password for ${email} (at least 8 characters): `);
if (password.length < 8) {
  console.error("Too short: use at least 8 characters.");
  process.exit(1);
}
const confirm = await askHidden("Type it again: ");
if (confirm !== password) {
  console.error("The two passwords don’t match. Nothing was changed.");
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
if (error) {
  console.error(`Could not set the password: ${error.message}`);
  process.exit(1);
}
console.log(`Password set. Sign in at ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login with ${email}.`);
