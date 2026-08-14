# Orbit

A macOS desktop app for organising work and study: tasks grouped into lists, three ways
to look at them, and a vertical day timeline you drag tasks onto to plan your hours.

Built with **Tauri 2** (native macOS shell) + **React 18** + **TypeScript** + **Vite**.
Visual style comes from the Nocturne design system — all tokens live in
`src/styles/nocturne.css`.

---

## 1. What you need installed

| Tool | Why | Check |
| --- | --- | --- |
| **Xcode Command Line Tools** | Rust needs Apple's linker | `xcode-select -p` |
| **Rust** (stable) | compiles the Tauri shell | `rustc --version` |
| **Node.js 18+** | runs Vite and the build | `node -v` |

Install the two that are usually missing:

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # then restart the terminal
```

Node: download the LTS installer from nodejs.org, or `brew install node`.

## 2. From download to running app

```bash
cd app             # the folder that holds package.json
npm install        # installs React, Vite, the Tauri CLI (~1 min)
cp .env.example .env
npm start          # = `tauri dev` — first run compiles Rust, 2–5 min. Later runs: seconds.
```

A real macOS window opens with hot reload: edit anything under `src/` and it updates live.

Nothing else is required — with an empty `.env` the app runs fully offline and keeps an
account plus all your data on this Mac. Create an account on the sign-up screen and start
using it.

One note: the icon set and the Inter font load from a CDN (`index.html`), so the first run
wants an internet connection. To make it fully offline, `npm i @phosphor-icons/web` plus a
local copy of Inter and import them in `src/main.tsx` instead.

**To get a double-clickable app** (unsigned, for your own machine):

```bash
npm run bundle
```

Output: `src-tauri/target/release/bundle/macos/Orbit.app` and a `.dmg` next to it.
Because it isn't code-signed, the first launch needs right-click → **Open** (or
System Settings → Privacy & Security → *Open Anyway*). Signing and notarising is only
needed to distribute it — we are not publishing yet.

**Optional, once you have a logo:** `npm run tauri icon path/to/logo.png` regenerates every
icon size from one image. A placeholder icon is already in `src-tauri/icons/icon.png`.

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm start` | run the desktop app with hot reload |
| `npm run dev` | run only the UI in a browser at `localhost:1420` (handy for quick styling) |
| `npm run build` | typecheck + build the web assets |
| `npm run bundle` | produce `Orbit.app` + `.dmg` |

---

## 3. How the project is laid out

```
app/
├─ src-tauri/            the native shell (Rust). Window size, menus, native commands.
│  ├─ src/lib.rs         add #[tauri::command] functions here
│  └─ tauri.conf.json    window + bundle settings
└─ src/
   ├─ pages/             one file per page + registry.tsx (THE page list)
   ├─ components/        shell, sidebar, modal, timeline, toast
   ├─ lib/
   │  ├─ types.ts        every domain type (Task, List, Prefs…)
   │  ├─ reducer.ts      every way data can change (one Action union)
   │  ├─ store.tsx       React context: data + dispatch + autosave
   │  ├─ selectors.ts    derived data (columns, buckets, timeline lanes)
   │  ├─ time.ts         time formatting + timeline geometry
   │  ├─ auth/           AuthProvider interface + local and Supabase implementations
   │  └─ persistence/    DataAdapter interface + local and Supabase implementations
   └─ styles/            nocturne.css (design tokens) + app.css (layout)
```

Three rules keep it easy to change:

1. **No component owns data.** Pages read `useStore().data` and send `dispatch({...})`.
   All mutations are cases in `src/lib/reducer.ts`.
2. **Backends sit behind interfaces.** `AuthProvider` and `DataAdapter` each have two
   implementations; the app picks one from environment variables at startup.
3. **Pages are registered, not hard-coded.** The sidebar, router and toolbar button are all
   derived from `src/pages/registry.tsx`.

---

## 4. Adding a new page

Two steps.

**1. Create the page.** `src/pages/ReviewPage.tsx`:

```tsx
import { useStore } from "../lib/store";

export default function ReviewPage() {
  const { data } = useStore();
  return (
    <div className="scroll pad">
      <h4>Review</h4>
      <p className="muted small">{data.tasks.length} tasks in total.</p>
    </div>
  );
}
```

**2. Register it.** In `src/pages/registry.tsx`, import it and add one entry:

```ts
{ id: "review", label: "Review", icon: "ph ph-list-checks",
  defaultPinned: false, primaryAction: "new-task", component: ReviewPage },
```

That is all. It appears in the sidebar's *More* group, can be pinned, hidden and dragged
like the others, gets the page transition, and existing accounts pick it up automatically
(`withRegistryPages` in `store.tsx` merges new pages into saved nav preferences).

- `id` is stored in user preferences — pick it once and don't rename it after release.
- `icon` is any [Phosphor](https://phosphoricons.com) class name.
- `primaryAction` controls the toolbar button: `"new-task"`, `"new-list"` or `"none"`.

**Adding a field to a task** is the same shape of change: add it to `Task` in
`lib/types.ts`, give it a default in `newTask()` in `lib/reducer.ts`, then use it. Nothing
else needs migrating — stored documents simply lack the key and get `undefined`, so give
new fields a sensible default when you read them.

---

## 5. Wiring Supabase (login, sign-up, sync)

Right now auth and storage use the local implementations. Switching is configuration, not
code: fill in `.env` and both `AuthProvider` and `DataAdapter` flip to Supabase on the next
launch.

### Step 1 — create the project

1. Sign up at supabase.com, **New project**, pick a region near you (free tier is fine).
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### Step 2 — put the keys in `.env`

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The anon key is safe in a desktop client — it only permits what your row-level security
policies allow. Never put the **service_role** key in the app.

### Step 3 — enable email auth

**Authentication → Providers → Email**: on. For testing, turn **Confirm email** off so
sign-up logs you straight in; turn it back on before real users exist. (With confirmation
on, `signUp` returns "Check your inbox…" and the account signs in after confirming.)

### Step 4 — create the table

**SQL Editor → New query**, run this:

```sql
create table public.workspaces (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  document   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "own workspace read"   on public.workspaces
  for select using (auth.uid() = user_id);
create policy "own workspace write"  on public.workspaces
  for insert with check (auth.uid() = user_id);
create policy "own workspace update" on public.workspaces
  for update using (auth.uid() = user_id);
```

One row per user holding the whole document as JSON. It syncs immediately and is the
fastest thing to reason about while the schema is still moving.

### Step 5 — restart

```bash
npm start
```

Sign-up and sign-in now hit Supabase, data loads from `workspaces` and saves 250 ms after
every change. Settings shows `supabase` as the backend, and the password prompt in
*Erase data* re-authenticates against Supabase.

### When to move to real tables

The JSON document is fine to a few thousand tasks. Split it when you want per-task queries,
sharing, or multi-device conflict handling. The migration is contained: write a new
`DataAdapter` (e.g. `persistence/supabaseRowsAdapter.ts`) with `tasks` and `lists` tables
mirroring `lib/types.ts`, plus these policies, and point `persistence/index.ts` at it.
Nothing in the UI changes.

```sql
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid references public.lists(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  due int not null default 0,
  important bool not null default false,
  est_min int not null default 60,
  start_min int,
  steps jsonb not null default '[]'::jsonb,
  notes text default '',
  remind text default 'none',
  repeat text default 'none',
  my_day bool default true,
  completed_at timestamptz,
  position int default 0,
  created_at timestamptz default now()
);

alter table public.lists enable row level security;
alter table public.tasks enable row level security;
create policy "own lists" on public.lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Why Supabase for this app

Postgres (so filtering by list, due date and project is a query, not a loop), auth
included, generous free tier, realtime subscriptions when you add multi-device sync, and
row-level security so a desktop client can talk to it directly without a backend of your
own. Clerk has nicer auth UX but leaves you needing a database; Firebase's document model
fights the filtering this app is built around.

---

## 6. Ideas to make Orbit better than the alternatives

The timeline is already the differentiator — most task apps stop at a list. These build on it.

**Planning**

- **Overcommitment warning.** Sum scheduled blocks against hours left in the day and say
  plainly "you've planned 11h into 7h". Nobody does this well, and it's the single most
  useful thing a planner can tell you.
- **Auto-fill my day.** One button that places today's unscheduled tasks into free gaps,
  respecting a "no work before 9am" preference. Suggest, don't impose — always leave it draggable.
- **Estimate vs. actual.** Track when a block was actually finished and, after two weeks, show
  "your 1h tasks really take 1h40". It makes future estimates honest.
- **Energy shape.** Let people mark hours as high/low focus and prefer heavy tasks in the
  high ones. Studying and client work want different slots.

**Study-specific (a real gap in generic tools)**

- **Course/deadline mode.** A list can hold an exam or hand-in date and work backwards into
  study blocks — spaced, not crammed the night before.
- **Session log per task.** Note what you actually got through, so picking a subject back up
  next week doesn't start from zero.
- **Reading-list tasks.** Page or chapter counts on a task, so progress is partial rather
  than a single checkbox.

**Feel**

- **Keyboard-first.** `⌘K` for a command palette, `⌘N` new task, `T` schedule to today,
  digits to set length. Power users switch tools for this alone.
- **Menu-bar mini view.** Next block and its remaining time, always visible — cheap to build
  in Tauri and the reason people keep an app open.
- **Native notifications** for reminders, with "start now / push 15 min" actions.
- **Week view.** The same vertical timeline across seven columns; the mental model carries over.
- **Undo everywhere** (`⌘Z`), including deletes. Confidence to move fast comes from being
  able to take it back.
- **Offline-first, always.** Local write, then sync. Study happens on trains and in basements.

**Restraint**

- No AI features until the basics feel excellent. No sub-sub-projects, no custom fields, no
  labels-on-labels. The reason people abandon these tools is that planning becomes the work.
  One clear question — *what am I doing in the next hour?* — answered better than anyone else.

---

## 7. Design prototype

`../Orbit.dc.html` at the repo root is the original interactive prototype for this app —
useful for trying an interaction quickly before implementing it here. It is not part of the
build.
