# MyFamily — Build Plan (v1)

A family web app, designed mobile-first for phone browsers, so it can later be wrapped as an installable app (PWA, then possibly native).

## 1. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router, Tailwind CSS |
| Backend | Node.js + Express API (TypeScript); runs locally on port 3001 and on Vercel as one serverless function under `/api` |
| Database / Auth / Files | Supabase (Postgres, Supabase Auth for email+password, Storage for the family photo) |
| Hosting | Vercel (frontend + `/api` in one project) |
| Source control | Git, in a single repo at `C:\dev\git\MyFamily`, pushed to GitHub (Vercel deploys from GitHub) |

### Repo layout
```
MyFamily/
├── src/               React app (Vite)
│   ├── pages/         Login, Register, Onboarding, Home, FamilyTasks, KidsTasks, ParentsTasks
│   ├── components/    AppLayout (sidebar), BirthdayInput, ui (cards, buttons)
│   ├── lib/           supabase client, api client, session context
│   └── index.css      theme colors + fonts
├── server/            Express API (routes: session, family, tasks)
├── api/index.ts       Vercel entry point → server/app.ts
├── supabase/migrations/  SQL schema, RLS, storage bucket, seed kids tasks
├── vercel.json
└── PLAN.md
```

## 2. Visual design (based on the reference screenshot)

The design takes the reference's style and swaps black surfaces for white:

- **Page background:** diagonal gradient from cyan to violet (`#22D3EE` → `#8B5CF6` → `#A855F7`)
- **Panels/cards:** white (`#FFFFFF`) with soft shadow and rounded corners (16px), replacing the black panels
- **Hero cards:** deep purple to indigo gradient (`#7B1FA2` → `#4C1D95` → `#3730A3`) with white bold text and a white "GO →" footer bar
- **Accent:** violet `#7C3AED` (icons, numbers, active nav)
- **Text:** near-black `#1F1B2E` on white; white on gradients
- **Font:** a bold condensed sans (Barlow Semi Condensed from Google Fonts), uppercase for card titles
- **Kids task tiles:** the playful style of the chore charts: numbered badge, large icon, colored border per tile, big tap-friendly checkbox
- **Navigation:** left icon sidebar on desktop; on mobile it collapses into a hamburger drawer

## 3. Users, login, and the first login

### 3a. Registering the family admin
- Fields: **email and password**, using Supabase Auth.
- The person who registers is the family **admin**.

### 3b. First login (onboarding wizard, shown only once)
Step 1, family details:
- **Family name** (for example "Cohen")
- **Admin name:** tells apart families with the same family name. Each family-name + admin-name pair must be unique.
- **Family photo** upload (JPG/PNG, max ~5MB, stored in Supabase Storage)

Step 2, family members (add as many as needed; the admin is the first member):
- Name
- Kid / Parent
- Birthday (`MM-DD-YYYY`)
- Age: worked out automatically from the birthday (shown, not typed), so it never goes out of date

When the wizard finishes, the family is marked `onboarded = true` and the app goes to Home.

### 3c. Later logins (member login)
After a family has been set up, the login page offers two options:
1. **Family member login:** Family name + admin name + member name + birthday (all four, always)
2. **Admin login:** email + password (needed to manage the family)

> ⚠️ Security note: a birthday is easy to guess. For v1 it is accepted as asked, but I suggest an optional 4-digit PIN per member later on, and member sessions limited to "family-level" actions (they can't edit the family or members).

**How member login works technically:** the Node API (`POST /api/member-login`) checks family, name and birthday against the DB with the Supabase service key, then issues a signed session token (JWT, httpOnly cookie). Every other API call checks that token and limits data to that member's family.

## 4. Data model (Supabase / Postgres)

```
families
  id uuid PK, family_name text, admin_name text, photo_path text,
  owner_user_id uuid → auth.users, onboarded bool, created_at
  UNIQUE (lower(family_name), lower(admin_name))

members
  id uuid PK, family_id → families, name text, role ('kid'|'parent'),
  birthday date, is_admin bool, auth_user_id uuid NULL, created_at
  UNIQUE (family_id, lower(name))

kid_task_templates          -- the default 12–15 kids tasks (seeded)
  id, title, icon, sort_order, active bool

kid_task_checks             -- "kid X did task Y on day Z"
  id, member_id → members, template_id → kid_task_templates, day date, checked_at
  UNIQUE (member_id, template_id, day)

parent_tasks                -- free-text tasks for parents/adults
  id, family_id → families, created_by → members, assigned_to → members NULL,
  text, day date, done bool, created_at
```

- Row Level Security is on for every table. The browser never uses the service key; all data access goes through `/api`, which applies family scoping.
- Storage bucket `family-photos` is private and served with signed URLs.

## 5. Pages (first version)

1. **Login** / **Register** / **Onboarding** (above)
2. **Home**
   - Left sidebar with the page list (for now: Home, Family Tasks; later items appear as "coming soon")
   - **Family photo in the center**, with the family name as the title and member avatars/names underneath
3. **Family Tasks**: a choice screen with two large gradient cards, **KIDS** and **PARENTS** (same style as "MY PATH / TEACHER ASSIGNED")
4. **Kids Tasks**
   - Pick a kid (tabs/avatars), then a grid of **14 daily tasks** for **today**
   - Tap a tile to check or uncheck it (saved per kid per day); progress bar "8 / 14 done" with a small celebration at 100%
   - Default tasks:
     1. Wake up & make my bed
     2. Brush my teeth (morning)
     3. Get dressed
     4. Eat breakfast
     5. Pack my school bag
     6. Do my homework
     7. Read for 20 minutes
     8. Clean my room
     9. Help set / clear the table
     10. Feed the pet / water the plants
     11. Put clothes in the hamper
     12. Take a shower / bath
     13. Brush my teeth (evening)
     14. Put on pajamas & get ready for bed
5. **Parents Tasks**
   - A free-text box with an "Add" button, then a list of today's tasks
   - Each task: check off, edit, delete; optional "assigned to" (parent)
   - Filter: Today / All open

## 6. API endpoints (Node, `/api`)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/onboarding` | create family + members (admin only, once) |
| POST | `/api/family/photo` | upload/replace family photo |
| GET | `/api/family` | family + members + signed photo URL |
| GET | `/api/families/lookup?name=` | admin names for a family name (for member login) |
| POST | `/api/member-login` | family + name + birthday → session |
| POST | `/api/logout` | clear session |
| GET | `/api/kids/:memberId/tasks?day=` | templates + checks for a day |
| PUT | `/api/kids/:memberId/tasks/:templateId?day=` | check / uncheck |
| GET/POST/PATCH/DELETE | `/api/parent-tasks` | list/add/edit/delete parent tasks |

## 7. Build phases

| # | Phase | Result |
|---|---|---|
| 0 | **Setup**: git init, Vite React app, `/api` folder, Tailwind + theme, Supabase project, `.env` files, GitHub repo, Vercel project | "Hello MyFamily" running locally and on Vercel |
| 1 | **Database**: migrations for all tables, RLS, storage bucket, seed kids tasks | schema in Supabase |
| 2 | **Admin auth**: register / login / logout with Supabase Auth | admin can sign in |
| 3 | **Onboarding wizard**: family details, members, photo upload | family created on first login |
| 4 | **Member login**: lookup + birthday check + session cookie | kids and parents can sign in |
| 5 | **Home**: sidebar + centered family photo, responsive drawer on mobile | main layout done |
| 6 | **Family Tasks**: chooser, Kids page, Parents page | first feature complete |
| 7 | **Polish & deploy**: mobile QA, loading/error states, PWA manifest + icon | live on Vercel |

Each phase is its own commit (or PR) in git.

## 8. Later (not in v1)
- Installable PWA, then a native wrapper (Capacitor)
- Admin can edit the kids task list per family/kid; rewards and streaks (like the XP panel in the reference)
- Member PINs, editing members after onboarding
- More pages: calendar, shopping list, chores chart by weekday

## 9. Decisions (answered 2026-11-16)
1. **Supabase:** new project "MyFamily" (`xhfklcgkohizqphnigua`, eu-central-1)
2. **Git:** local repo in `C:\dev\git\MyFamily`; we push changes to a remote ourselves
3. **Language:** English only
4. **Kids tasks:** both kids and parents can tick. Kids see and tick only their own; parents can tick for any kid. The task list is fixed for v1.
5. **Member login:** family name + admin name + name + birthday, no PIN. Limited to 10 failed tries per family per 15 minutes.
6. **Parents tasks:** only parents can add, edit or delete them; kids see them read-only.
