# Rebuild MyFamily from scratch

This file is a complete build spec for the MyFamily app. Give it to Claude Code (or a developer) in an empty folder with the instruction:

> Build the app described in REBUILD.md, step by step. Ask me for the Supabase and Vercel details when you reach those steps.

Following it should produce the same app as https://myfamily-gules.vercel.app: same pages, rules, data model, look and deployment. Where it says **must**, the behaviour is a decision the family made; keep it.

---

## 1. What the app is

A private web app for one family per account. It's mobile-first but also comfortable on tablets, laptops and large screens. All UI text is English and dates show as **MM/DD/YYYY** (birthdays are typed as **MM-DD-YYYY**).

Pages, in menu order:

1. **Home**
2. **Family Tasks**, which opens Kids, Parents and Dashboard
3. **Calendar**
4. **Shopping List**
5. **Settings** (admin only)
6. **Help**
7. **Food menu**, shown greyed out under "Coming soon"

## 2. Stack and project layout

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4 (tokens in `@theme` in `src/index.css`), react-router-dom v6, lucide-react icons.
- **API:** Node + Express 5 (TypeScript, ESM, `"type": "module"`), mounted under `/api`.
  - Locally it runs from `server/dev.ts` on port 3001 with `tsx watch`.
  - Vite runs on port 3000 and proxies `/api` to the API.
  - On Vercel, `api/index.ts` default-exports the Express app.
- **Supabase:** Postgres, Auth (email/password for the family admin only), Storage. The server uses `@supabase/supabase-js` with the secret key. The browser uses the publishable key only for admin sign-in and sign-up.
- **Hosting:** Vercel, region `fra1`.

```
api/index.ts                  Vercel function → server/app.ts
server/app.ts                 express app: cookie-parser, json (100kb), routers, 404, error handler
server/dev.ts                 local listener on API_PORT (3001)
server/auth.ts                caller resolution, member session cookie, memberOf()
server/supabase.ts            db() client (secret key), PHOTO_BUCKET name
server/util.ts                HttpError, handle(), parseDay, parseBirthday, requireText
server/rewards.ts             reward columns/types
server/removals.ts            clientDay(), recordRemovals(), clearRemovals(), kidsOf()
server/routes/{session,family,settings,tasks,calendar,shopping,categories}.ts
src/main.tsx                  routes + guards (Public, OnboardingGate, Private, Role)
src/lib/{api,session,supabase,image,taskIcons,rewardIcons,categories}.ts(x)
src/components/{AppLayout,ConfirmDialog,ErrorBoundary,CheckDropdown,PhotoSourceButton,Face,BirthdayInput,ui}.tsx
src/pages/{Login,Register,Onboarding,Home,FamilyTasks,KidsTasks,ParentsTasks,Dashboard,Calendar,Shopping,Settings,Help}.tsx
public/task-icons/*.png, public/reward-icons/*.png, public/task-photos/*.jpg, public/default-family.jpg
supabase/migrations/*.sql
vercel.json, .env.example
```

`vercel.json`:

```json
{
  "framework": "vite",
  "regions": ["fra1"],
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- .",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Environment variables (`.env.example`; the real values go in `.env.local`, which **must never be committed**):

| Name | Side |
|---|---|
| `VITE_SUPABASE_URL` | browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser |
| `SUPABASE_URL` | server |
| `SUPABASE_SECRET_KEY` | server only |
| `SESSION_SECRET` | server only, 32+ random characters |

## 3. Security model (must)

- **RLS on every table with no policies.** The browser never reads tables directly; every read and write goes through the API with the secret key.
- **Every query is scoped by the caller's `family_id`.** Ids from the URL or body are always re-checked against the family. Another family's id gets **404**, never 403, so the response doesn't reveal that it exists.
- **Callers.** `requireCaller` middleware resolves one of these:
  - **Admin:** `Authorization: Bearer <Supabase access token>`, verified with `auth.getUser`. The member is the `members` row with `is_admin` in the family whose `owner_user_id` is that user. If the admin hasn't finished onboarding, `member` is null.
  - **Family member:** `mf_session` cookie, an HS256 JWT `{ sub: memberId }` signed with `SESSION_SECRET`.
    - It lasts 30 days.
    - Cookie flags: httpOnly, sameSite=lax, `secure` in production, path `/`.
  - The browser signs out of Supabase locally before a member login, so an admin token can't override the member cookie.
- **Roles.**
  - `parent` or `kid`.
  - "Parent only" routes return **403** for kids.
  - Settings routes require `kind === 'admin'` **and** `is_admin`. A parent signed in through member login can't change settings.
- **Member login rate limit.** Each failed attempt inserts a row into `member_login_failures`. 10 failures in 15 minutes for a family returns **429** "Too many tries. Please wait 15 minutes and try again."
- **Auto logout.**
  - The browser logs out after **15 minutes** with no mouse, keyboard or touch activity in any tab.
  - The last-activity time is shared through `localStorage`, so it also applies when the app is reopened later.
  - The login page then shows a "You were logged out after 15 minutes without activity" notice.
- **Photos.**
  - Family, face and parent-task photos live in the private bucket `family-photos` and are served through signed links that last 1 hour.
  - Kid-task and reward photos a family uploads live in the public bucket `task-images` at `<family_id>/<uuid>.<ext>`.
    - Their URL must start with that family's prefix, or the server refuses it.
  - Uploads are raw bodies (`image/jpeg|png|webp`) and are resized or square-cropped in the browser first.
    - Family and parent-task photos: up to 4 MB.
    - Face, task and reward pictures: up to 2 MB.
- **Errors.** The browser shows a readable message. An `ErrorBoundary` replaces a crashed page with "Something went wrong on this page" and a Reload button. Every delete asks first in a small confirm window (`useConfirm`), never `window.confirm`.

## 4. Database (Postgres, schema `public`)

Create these with migrations. `day`-type columns hold the family's local date, which the browser sends as `YYYY-MM-DD`.

```sql
create table families (
  id uuid primary key default gen_random_uuid(),
  family_name text not null check (length(btrim(family_name)) between 1 and 60),
  admin_name text not null check (length(btrim(admin_name)) between 1 and 60),
  photo_path text,
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  role text not null check (role in ('kid','parent')),
  birthday date not null,
  is_admin boolean not null default false,
  photo_path text,
  created_at timestamptz not null default now()
);

-- family_id null = the default list copied into every new family
create table kid_task_templates (
  id integer generated always as identity primary key,
  family_id uuid references families(id) on delete cascade,
  title text not null,
  icon text not null,                 -- gallery key (e.g. 'bed') or https URL of an uploaded photo
  period text not null default 'general' check (period in ('morning','general','evening')),
  sort_order smallint not null,
  member_ids uuid[],                  -- null = every kid
  mandatory boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,            -- deleted: noon UTC of the family's delete day
  created_at timestamptz not null default now()
);

create table kid_task_checks (
  member_id uuid not null references members(id) on delete cascade,
  template_id integer not null references kid_task_templates(id) on delete cascade,
  day date not null,
  checked_by uuid references members(id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (member_id, template_id, day)
);

-- A task taken away from one kid: it still counts for that kid before removed_on
create table kid_task_removals (
  template_id integer not null references kid_task_templates(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  removed_on date not null,
  primary key (template_id, member_id)
);

create table kid_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  kind text not null default 'daily' check (kind = 'daily'),
  min_score smallint not null check (min_score between 1 and 100),   -- tasks needed in one day
  icon text not null default 'gift' check (icon ~ '^[a-z0-9-]{1,30}$' or icon like 'https://%'),
  member_ids uuid[],                  -- null = every kid
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table parent_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  subject text not null check (length(btrim(subject)) between 1 and 80),
  text text check (text is null or length(text) <= 1000),              -- description
  day date not null,                                                    -- start date
  due_date date check (due_date is null or due_date >= day),            -- end date, optional
  assigned_to uuid references members(id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  icon text check (icon is null or icon ~ '^[a-z0-9-]{1,30}$'),
  photo_path text,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  day date not null,                                                    -- first day
  end_day date check (end_day is null or end_day >= day),               -- last day; null = one day
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note text check (note is null or char_length(note) <= 500),
  category text check (category is null or char_length(category) between 1 and 30),
  remind_on date check (remind_on is null or remind_on <= day),
  remind_time text check (remind_time is null or remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on calendar_events (family_id, day);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  bought boolean not null default false,
  bought_at timestamptz,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on shopping_items (family_id, category);

-- Categories a family added by hand (built-in ones live in the code)
create table family_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  kind text not null check (kind in ('shopping','calendar')),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create unique index on family_categories (family_id, kind, lower(name));

create table member_login_failures (
  id bigint generated always as identity primary key,
  family_id uuid not null references families(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- enable RLS on every table above, add no policies
```

**`create_family(p_owner uuid, p_family_name text, p_admin_name text, p_members jsonb) returns uuid`**
- Language plpgsql, `set search_path = ''`.
- It does three things:
  1. Inserts the family.
  2. Inserts each member from `p_members` (`name`, `role`, `birthday`, `is_admin`).
  3. Copies every `kid_task_templates` row with `family_id is null` into the new family.
- Revoke it from `public`, `anon` and `authenticated`; grant it to `service_role`.

**Default kids tasks** (`family_id null`):

| # | title | icon | period |
|---|---|---|---|
| 1 | Make my bed | bed | morning |
| 2 | Brush my teeth (morning) | toothbrush | morning |
| 3 | Get dressed | tshirt | morning |
| 4 | Eat breakfast | breakfast | morning |
| 5 | Pack my school bag | backpack | evening |
| 6 | Do my homework | pencil | general |
| 7 | Read for 20 minutes | books | general |
| 8 | Clean my room | cleaning | general |
| 9 | Help set the table/dishes | plate | general |
| 10 | Feed the pet / water the plants | plant | general |
| 11 | Put clothes in the hamper | basket | general |
| 12 | Take a shower | shower | evening |
| 13 | Brush my teeth (evening) | tooth | evening |
| 14 | Put on pajamas | pajamas | evening |

**Storage buckets:** `family-photos` (private) and `task-images` (public).

## 5. API (all under `/api`, JSON)

| Method & path | Who | What |
|---|---|---|
| GET `/health` | anyone | `{ok:true}` |
| GET `/me` | signed in | `{ member, family, members[] }`. Each member has `age` and `photoUrl`; the admin also gets birthdays. 401 if not signed in. |
| POST `/member-login` | anyone | body `familyName, parentName, name, birthday` (MM-DD-YYYY). All name matching is case-insensitive and exact. `parentName` is the name of any parent in the family, which tells apart families with the same name. Sets the cookie. |
| POST `/logout` | anyone | clears the cookie |
| POST `/onboarding` | admin without a family | `familyName, adminName, members[]`. The admin is one of the parents. Calls `create_family`. |
| POST/DELETE `/family/photo` | admin | raw image / remove |
| GET/POST `/settings/members`, DELETE `/settings/members/:id`, POST/DELETE `/settings/members/:id/photo` | admin | members and face photos. The admin can't remove themselves. |
| POST `/settings/task-image` | admin | raw image to `task-images`; returns `{url}` |
| GET/POST `/settings/kid-tasks`, PATCH/DELETE `/settings/kid-tasks/:id?day=`, PUT `/settings/kid-tasks/mandatory` | admin | see the Kids tasks rules. Up to 40 tasks. |
| GET/POST `/settings/rewards`, PATCH/DELETE `/settings/rewards/:id` | admin | `title, icon, minScore, memberIds ('all' or ids)`. Delete sets `archived_at`. |
| GET `/kids/:memberId/tasks?day=` | kid (self) or parent | the kid's tasks with `checked`, plus their rewards |
| PUT `/kids/:memberId/tasks/:templateId` | kid (self, today only) or parent (up to 5 days back) | body `day, checked`. Upserts or deletes the check. |
| DELETE `/kids/:memberId/tasks/:templateId?day=` | parent | removes the task for that kid only and records `kid_task_removals` |
| GET `/parent-tasks?filter=today&day=` / `open` / `done` | parent | see Parents tasks |
| POST, PATCH/DELETE `/parent-tasks/:id`, POST/DELETE `/parent-tasks/:id/photo` | parent | |
| GET `/stats?memberIds=all\|ids&from=&to=` | parent | Dashboard data, at most 92 days |
| GET `/calendar?from=&to=&today=&now=HH:MM` | signed in | `{events, reminders, birthdays[{memberId,name,monthDay}]}`, range at most 62 days |
| GET `/calendar/upcoming?today=&category=` | signed in | next 10 not-over activities |
| POST, PATCH/DELETE `/calendar/:id` | signed in (kids: only their own for change/delete) | |
| GET `/categories?kind=shopping\|calendar`, POST `/categories`, DELETE `/categories/:id` | signed in; delete parents only | |
| GET/POST `/shopping`, PATCH/DELETE `/shopping/:id`, DELETE `/shopping?scope=bought\|all&category=` | signed in; bulk delete parents only; kids delete only their own | |

`?day=` on removal and delete routes is the family's today. The server accepts it only within ±1 day of its own UTC date, otherwise it uses its own date (`clientDay`).

## 6. Business rules (must)

### Kids tasks

- A task with `member_ids` null is for every kid; otherwise it's only for the listed kids.
- Kids see three bands: **Morning**, **During the day** (`general`) and **Evening**.
- **Must do** tasks show a red "Must do" label.
- **Who can tick what.** Kids tick only their own tasks and only today. Parents can tick for any kid, and on the last **5 days** (the day arrows stop there; the server allows ±1 day for time zones).
- **Deleting a task in Settings.** `archived_at` is set to noon UTC of the family's today. The task disappears from that day on, and earlier days stay in the Dashboard.
- **Removing a task for one kid.** This happens from the Dashboard or by changing a task's kids in Settings.
  - A `kid_task_removals(removed_on = today)` row is upserted.
  - It still counts for that kid before that day.
  - Giving the task back to the kid deletes that removal row.

### Rewards (per day)

- **When it's earned.** A reward is earned on a day when **done ≥ min_score** (no rounding down to the list size) **and every must-do task on that day is done**.
- **Kids page.** It only looks at the day shown. "Rewards start again every day."
  - The top banner shows "N more for <next reward>" or "finish the must-do tasks for <reward>".
  - When a reward is reached it shows "Reward earned: <best reward>! 🏆".
  - The Rewards window lists each reward as **Earned today!**, "N more", "N must-do left", or "Needs N tasks" when the kid has fewer tasks than the reward needs.
- **Dashboard.** The count is the number of days each reward was earned in the range, per kid.

### Dashboard statistics (`/stats`)

- **Which tasks count on a day.** For each kid and each day in the range, the kid's **full list** counts when both of these hold:
  - The task isn't deleted before that day (`archived_at`) and isn't removed for that kid before that day (`kid_task_removals`).
  - Either the task and the kid both existed that day (on or after their `created_at` dates), or a parent filled in that earlier day by ticking anything for that kid.
- So **100% means every task on the list**, not only the ticked ones.
- **Per day:** done / total.
- **Per period:** morning, general, evening.
- **Per task:** done / total, with an `archived` flag when the task is deleted or removed for that kid.
- **Rewards:** days earned.
- **Summary:** done, total, percent.

### Parents tasks

- **Required:** subject and assignee (any parent in the family; never a kid).
- **Optional:** description (up to 1000), start date (default today), end date (empty means no end date), and a picture. The picture is either a gallery key or an uploaded photo, never both.
- **Status chip:**
  - Done MM/DD/YYYY
  - Not started yet (start date is later)
  - Overdue (end date passed)
  - Ends today
  - In progress (also used when there's no end date)
- **Filters** (default **All open**):
  - **Open today:** started and not done, plus ones done today. Uses the browser's date; the server sends tasks done in the last 36 hours.
  - **Due today:** not done, with an end date of today or earlier.
  - **All open:** every task not done, including future ones.
  - **Done:** done tasks, most recently finished first, up to 200.
  - A task ticked in All open leaves that list. Unticking a task in Done reopens it.
- **"Everyone / parent" dropdown:** shows only the chosen parents' tasks.
- **Each parent has their own colour.** It shows on the left stripe of the task, the name chip (no "For" word) and the dot in the filter. Colours are assigned by the parent's fixed position, in this order of the category palette: 2, 3, 1, 6, 4, 0, 5, 7.

### Calendar

- **An activity has:** a title, an optional category, a start date, an optional end date (it shows on every day it runs), an optional time and an optional note.
- **Reminder:** a date on or before the start, plus a time. Picking any reminder date sets the time to **08:00** unless a time was already set.
  - Quick buttons: No reminder, Same day, 1 day before, 2 days before, 1 week before.
- **When a reminder shows.** From `remind_on` (and from `remind_time` on that day, using the browser's `now`) until the activity is over (`end_day` or `day` ≥ today).
  - It shows in a yellow **Reminders** bar on the Calendar page and on Home.
- **Built-in categories:** **Vacation, Work, Kids**. The family can add more with "+ New category" in the form.
  - Each category has a colour from the palette, chosen by its position in the family's list.
- **Birthdays** of every member show on their month and day (🎂).
- **Next 10:** the activities that aren't over yet, by date and time, filtered by **All** or one category.
  - **Share** uses `navigator.share`. If that's missing, it copies the list to the clipboard instead.
  - Shared text: "Our next activities:" followed by one "• Sat, Dec 20 to Sun, Dec 28, 4:30 PM: Title (Category)" line per activity.
- **Editing.**
  - Everyone can add. Parents can change or delete any activity; kids only their own.
  - Moving an activity earlier than its reminder moves the reminder to the new date.

### Shopping list

- **Built-in categories:** **Groceries, Clothes, Appliances**. "+ New" adds the family's own; adding a name that already exists is refused (case-insensitive, built-ins included).
- **Adding products.** Choose a category and type products **one per line** (commas also split), then Add (or Ctrl+Enter). After adding, **both the category and the products reset**.
- **Columns.** One column per category: built-ins first, then the family's own, then any older category names still on the list.
  - Each column title has its own colour.
  - Products stack one under another.
  - Tapping a product marks it as bought (crossed out); tapping again puts it back.
- **Deleting.**
  - The bin on a product deletes it. Kids can only delete what they added.
  - Parents can also do the following, each asking first:
    - Remove bought (all, or one category)
    - Empty a category
    - Delete the whole list
    - Remove one of their own categories once it's empty
- **Scrolling.** Up to 5 columns fit on wide screens (4 on laptops, 2 on tablets, about 1.3 on phones), and the rest scroll sideways.
  - When some columns are off screen, a yellow notice "N categories, not all fit on the screen. Scroll right to see the rest." appears, with ‹ › buttons.

### Login and onboarding

- **Register** with an email and password (Supabase sign-up, `emailRedirectTo = origin + /onboarding`).
- **Onboarding.** The admin enters the family name, their own name, and members.
  - Each member has a name, a role (kid or parent) and a birthday (MM-DD-YYYY, a real date, not in the future, year 1900 or later).
- **Login page tabs.**
  - *Family admin:* email and password.
  - *Family member:* family name, parent's name, your name and birthday.
- **After a member logs in:** kids **under 8** go to `/tasks/kids`; everyone else goes to Home.

## 7. Pages and layout

### Layout

- **Laptop width and up (`lg`, 1024px):** a white side panel (256px) on the left.
  - It shows the logo, the menu, "Coming soon: Food menu", and a "Signed in as <name> <Admin|role>" card with **Log out**.
  - The page itself sits in a white rounded panel beside it.
  - The panel has a gradient title band with an icon, the page title and a **today badge** (weekday over MM/DD) on the right.
- **Below laptop width:** a gradient top bar with a ☰ button that opens the menu as a drawer.
- **Nothing may be wider than the screen** at 375px, 768px, 1366×768 or 1920px. Wide tables and column rows scroll inside their own box.

### Pages

- **Home**
  - "Hi <name>!" and "The <Family name> Family" in large type.
  - The admin sees a camera button to change the photo, and a remove button.
  - The Reminders strip appears when any reminders are due.
  - The family photo is shown **whole, never cropped**, centred with white margins. Until one is uploaded, `public/default-family.jpg` shows with a "Sample photo" note.
  - A single row shows every member's avatar (face photo or initial), name and age.
- **Family Tasks**
  - Up to three big gradient cards that share the page height: **Kids** (everyone), **Parents** (parents) and **Dashboard** (parents).
  - Each card has a picture, a large title, a line of text and an **Open** pill. The cards grow on taller screens.
- **Kids Tasks**
  - A "‹ Family Tasks" back link and kid chips (parents only).
  - A **Rewards** button with a count badge, and ‹ day › arrows with "Today, MM/DD" or "Yesterday, MM/DD".
  - **Banner:** "N more for …", the done/total count, and a sticker strip where each done task adds its picture.
    - When every task is done, the banner switches to the gradient with "Amazing, <name>! All done! 🎉".
  - Three bands, one per period, each with its own background:
    - Morning: `#FFF3D1`, heading `#8A5200`
    - Day: `#E2F6FC`, heading `#0B5E7A`
    - Evening: `#2A1F66`, white heading
  - Each band shows its label and done count, then task cards (picture, title, stamp tick and Must do label).
  - Viewing a past day as a kid shows "View only".
- **Parents Tasks**
  - A "New task" form: subject, description, picture (camera upload or gallery), start date, end date, "Assigned to", Add, and the hint "Leave the end date empty for a task with no end date."
  - Then the filters, then the task list.
  - **Each task** has a bold stamp circle, the subject, a status chip, the description, dates, the assignee chip, "Added by X on date", and a picture on the right.
  - On phones the picture moves under the text and the edit and delete buttons stack.
- **Dashboard**
  - A "‹ Family Tasks" back link.
  - **Filters in one row:** Kids (checkbox dropdown, default **All kids**) and Dates (Today, Last 7 days by default, Last 14 days, Last 30 days, or Choose dates…). The custom range is up to 92 days.
  - **Tiles:** Tasks done (percent, "X of Y tasks, range") and one tile per reward (picture, name, times earned).
  - A legend when more than one kid is selected.
  - **Charts** (each shows its date range; every colour comes from the categorical palette below):
    - **Tasks done per day:** SVG line chart, one line per kid. It's drawn at its real width, with gridlines at 0/50/100%, a hover crosshair and a tooltip.
    - **By time of day:** horizontal bars per kid for each period.
    - **Task rate:** a vertical bar per task, best first.
      - The percentage sits above each bar and the task picture below it.
      - Pointing at a bar shows a tooltip with the task name and "Done N times".
    - **Rewards earned per kid:** a table with a column per kid, a Total column and a note "Each reward can be earned once a day". On phones it scrolls sideways.
- **Calendar**
  - The Reminders bar, then the month grid with the side panel.
  - **Month grid:**
    - ‹ Month YYYY › and a Today button.
    - The **first row is the weekday names Sun to Sat** on a violet band, then whole weeks.
    - Each day cell shows its number (today in a violet circle), a bell when a reminder falls on it, birthday chips and activity chips in their category colours. Days after the first of a multi-day activity show "↳ Title".
    - On phones, chips become coloured dots.
  - **Side panel:** a toggle between the selected day and **Next 10**.
    - Day view: "Add activity or reminder", the day's birthdays and activities.
    - Activity cards: a category-coloured left border, chips, time, reminder, "Added by", the note, and edit and delete buttons.
  - On wide screens (`xl`) the panel sits on the right; otherwise it goes under the month.
  - The add/edit form is a modal.
- **Shopping List:** the "Add to the list" form (category select with + New, products textarea, Add), the count "N to buy, M bought", the parent buttons, then the columns.
- **Settings** (admin): tabs for **Family members**, **Kids tasks** and **Rewards**.
  - **Members:** avatar, name, "Parent, MM-DD-YYYY, age N", a face photo button and Remove (not for the admin). "Add family member" opens an inline form.
  - **Kids tasks:**
    - An add form: name, time of day, picture grid (gallery and "Your own picture" upload), must-do, and which kids.
    - The list is grouped by period. Each task has its kids, a must-do toggle and remove.
    - "Removed tasks disappear from today on. Past results stay in the Dashboard."
  - **Rewards:**
    - The add form sits at the top: reward name, "Tasks needed per day", picture grid (20 reward pictures plus a camera "Your own picture"), and for which kids.
    - "Your rewards" list: each row has its picture, title, "N tasks a day, including all must-do tasks, for <kids>", a pencil that opens the edit form inline in the row, and a bin.
- **Help:** topic chips at the top, then one card per topic covering every page and rule above. Kids don't see the parents-only topics.

## 8. Look and feel ("Fridge door")

- **Fonts** (Google Fonts):
  - **Baloo 2** (500/700/800) for headings, big numbers and anything `font-extrabold`.
  - **Figtree** (400 to 700) for body text.
- **Colour tokens:**

| Token | Value |
|---|---|
| ink | `#1E1640` |
| muted | `#5B5378` |
| line | `#E4DEFA` |
| soft | `#F4F1FF` (page background) |
| violet | `#6D3BF5` |
| violet-dark | `#4B22C9` |
| violet-soft | `#EDE7FF` |
| cyan | `#19C2E6` |
| sun | `#FFB703` |
| sun-soft | `#FFF3D1` |
| sun-ink | `#8A5200` |
| night | `#2A1F66` |
| day-soft | `#E2F6FC` |
| day-ink | `#0B5E7A` |
| success | `#12925F` |
| danger | `#D93A5B` |

- **Gradients:**
  - `.hero-gradient`: 120°, cyan → violet 55% → violet-dark. Used for title bands and the "all done" banner.
  - `.card-gradient`: 120°, violet → violet-dark.
- **Shapes:**
  - Rounded panels (20 to 28px), pill buttons (`.btn`, `.btn-primary`, `.btn-ghost`), inputs with a 2px line-coloured border.
  - `.lift` adds a soft violet shadow to main items.
- **`.stamp`:** the tick circle. It's grey-bordered when off. When on, it's filled violet with a white inner ring and tilted -10°, with a springy scale animation.
  - `.stamp-bold` (parents tasks and shopping) uses a 4px violet-dark border and a soft violet glow.
- **Category palette** (background / text), in order:

| # | Background | Text |
|---|---|---|
| 0 | `#FFE3B3` | `#7A4300` |
| 1 | `#D3F3E1` | `#0E6239` |
| 2 | `#DCEAFF` | `#1D4A93` |
| 3 | `#FFDCE6` | `#992247` |
| 4 | `#E9DEFF` | `#4D25BF` |
| 5 | `#D2F2F7` | `#0A6170` |
| 6 | `#FFDFCF` | `#983C17` |
| 7 | `#E7ECC4` | `#4F5915` |

- **Kids' chart colours** (fixed by the kid's position in the family): `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #6250d6 #e34948`.
- **Motion:** `prefers-reduced-motion` is respected, and focus is visible on every control.
- **Pictures:** use only free, licensed images, never watermarked stock.
  - **Microsoft Fluent Emoji 3D** (MIT) PNGs, in two folders:
    - `public/task-icons/<key>.png`: the task gallery of 50 keys (see `TASK_ICONS`), from bed, toothbrush and tooth through cleaning, plant and the pets.
    - `public/reward-icons/<key>.png`: gift, money, dollar, coin, candy, lollipop, icecream, chocolate, pizza, game, tv, movie, toy, ball, balloon, park, book, trophy, medal and star.
  - **Public-domain / CC0 photos** in `public/task-photos/<key>.jpg`. Where a photo exists it's used in place of the emoji. Credits go in `public/LICENSE-photos.md`.
  - The period pictures are `sun`, `daytime` and `moon`.

## 9. Build order

1. Scaffold Vite + React + TS + Tailwind v4, Express + tsx, and `concurrently` (`npm run dev` runs both). Add `npm run build` (`tsc -b && vite build`) and `npm run typecheck`.
2. Create the Supabase project (ask the owner). They put the keys in `.env.local` themselves; never paste keys into chat or commit them.
3. Apply the migrations from section 4, seed the 14 default tasks, and create both buckets.
4. Build the server: auth, util, then the routes in the order of section 5.
5. Build the browser: api helper (sends the Supabase token if signed in, cookie otherwise), session provider (`/me`, idle logout), guards, layout, then the pages in menu order, then Help.
6. Test end to end against the running app with two throwaway families. Check isolation (each family sees only its own data), every role rule, the reward and statistics rules, calendar ranges and reminders, shopping, and categories. Delete the test users at the end.
7. Check that every page fits at 375 / 768 / 1366×768 / 1920 wide with a headless browser (screenshots plus a "nothing wider than the screen" check).

## 10. Deploy

1. Push the code to GitHub (here it's the `MyFamily/` folder of `tomerket/Tomer_private`).
2. Create a Vercel project, connect the repo, and set **Root Directory** to `MyFamily` and the production branch to `main`.
3. Add the 5 environment variables in Vercel (Production).
4. In Supabase → Authentication → URL Configuration:
   - **Site URL:** the Vercel URL.
   - **Redirect URLs:** `<vercel url>/**` and `http://localhost:3000/**`.
5. From then on, every push to `main` deploys automatically. Check `/api/health`, then sign in on a phone.
