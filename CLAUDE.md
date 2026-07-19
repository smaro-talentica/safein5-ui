# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

SafeIn5 UI (package name `fe-fastin5`, PWA name "Fast in 5") — a React 19 + TypeScript SPA built with Vite, with installable PWA support. Requires Node `>=24.17.0` and npm `>=11.13.0` (pinned in `.nvmrc` / enforced via `engines`).

### MVP roadmap (approved plan)

The app is a role-gated PWA serving three flows, built in order: **Worker → Supervisor →
Admin**. Source of truth: the two SafeIn5 spec PDFs; where they conflict, the **"Response to
Talentica Questions" Q&A doc is newer and wins** (e.g. offline is NOT required; voice memo is the
primary capture input; PULSE's 4th step is "Shift" not "Steer").

Standing build decisions:

- **UI-only, no data wiring** for now — screens render placeholder data; flows are not yet
  connected across roles and there is no backend/mock store. Do not build data plumbing until asked.
- Everything sits **behind a login and is gated by role**; the bottom nav is role-specific.
- Pages live under `src/pages/<role>/` per the role-partitioning rule below.

Planned routes (not all built yet — add per phase):

- **Shared:** `/login`, `/scan` (+ `/scan/success`, `/scan/fail`), `/qr/:code`, `*` (404).
- **Worker:** `/home`, `/feed`, `/capture` (+ `/capture/classify`, `/capture/confirm`), `/take5`
  (+ `/take5/:contextId`), `/learn` (+ `/learn/:moduleId`), `/profile`, `/rescue/:contextId`.
- **Supervisor:** `/dashboard`, `/signals` (+ `/signals/:id`, `/signals/:id/action`).
- **Admin:** `/analytics` (+ `/analytics/exposure`), `/tenants` (+ `/tenants/:orgId`),
  `/learn-admin`.

## Commands

```bash
npm run dev          # dev server, development mode (HTTPS via basic-ssl, HMR)
npm run dev:stage    # dev server, staging mode
npm run dev:prod     # dev server, production mode
npm run build        # tsc -b type-check + vite build (production)
npm run build:dev    # build, development mode
npm run build:stage  # build, staging mode
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest (watch mode)
npm run preview      # serve last production build
```

- **Single test:** `npx vitest run src/utils.test.ts` (or `npx vitest run -t "<test name>"`). `npm test` runs Vitest in watch mode.
- **Type-checking** also runs live in the dev server via `vite-plugin-checker`, and `tsc -b` gates every build.
- The dev server runs over **HTTPS** in all modes (`@vitejs/plugin-basic-ssl`, applied only on `command === 'serve'`).

## Environments

Three environments are driven by Vite **mode** + matching env file: `development` → `.env.development`, `staging` → `.env.staging`, `production` → `.env.production`. Client-exposed vars **must be prefixed `VITE_`** (see `.env.example`). Use `.env.local` / `.env.<mode>.local` for git-ignored secrets.

Never read `import.meta.env` directly in components. Typed access is centralized in `src/utils/env.ts` — import `env`, `isDevelopment`, `isStaging`, `isProduction`. Add new variables there and in the `ImportMetaEnv` declaration in `src/vite-env.d.ts`.

## Architecture

- **Entry** (`src/main.tsx`): `<AppRoute />` inside `QueryClientProvider`, wrapped in `StrictMode`.
- **Routing** (`src/AppRoute/index.tsx`): one `createBrowserRouter` with a `RootLayout` (nav +
  `<Outlet />`) and child routes. Register every routed component here.
- **`@` alias** → `src/` (in `vite.config.ts` + `tsconfig.app.json`).

### Pages are partitioned by role (MANDATORY)

`src/pages/` is split by the user role a screen serves. A routed component lives at
`src/pages/<role>/<Name>/index.tsx` — **always follow this structure**:

```
src/pages/
├── shared/       screens reachable by ANY role (e.g. ScanQr, Login, NotFound)
├── worker/       role = WORKER      (Home, Feed, Capture, Learn, Profile)
├── supervisor/   role = SUPERVISOR  (Dashboard, SignalReview, …) — add when built
└── admin/        role = ADMIN       (Analytics, Tenants, Learn5Manager, …) — add when built
```

Rules:

- Put a screen under `<role>/` **only if the role changes what the screen is**; role-agnostic
  screens (QR scan, login, 404) go in `shared/`.
- Do **not** create empty `supervisor/`/`admin/` trees ahead of need — add a role folder when its
  first real screen is built.
- Role-agnostic **building blocks** stay shared and role-unaware: reusable logic+UI in
  `src/components/feature/` (e.g. `QrScanner`, `VideoRecorder`), pure presentation in
  `src/components/ui/`, cross-cutting code in `src/hooks/` and `src/utils/`. Never split these by
  role.
- The bottom nav is per-role: `src/components/ui/bottom-nav/constant.tsx` currently lists the
  worker tabs; when roles land it should be driven by the logged-in role.

### Component layers (enforced by directory)

- `src/components/ui/` — purely presentational, reusable building blocks. **Styling only, no business logic or state.** shadcn/ui components are added here.
- `src/components/feature/` — reusable components combining **styling AND logic** (data fetching, state, behavior) for a feature.
- Compose Tailwind classes through `cn()` from `@/utils/cn` (clsx + tailwind-merge); use `class-variance-authority` for variant APIs (see `src/components/ui/button.tsx` for the canonical pattern).

### Generated-component folder structure

When **you (an agent) scaffold a new component on your own**, each component is its own folder whose concerns are split into dedicated files by role. `index.tsx` is always present; the others are created **only when that concern actually exists** — do not scaffold empty placeholder files.

```
<ComponentName>/
├── index.tsx     # the component itself (JSX/rendering + wiring). Always present.
├── model.tsx     # TypeScript types/interfaces for this component (props, domain shapes).
├── helper.tsx    # pure, framework-agnostic JS/TS logic (formatting, parsing, computation).
├── constant.tsx  # constants for this component (magic numbers, config, static maps).
├── action.tsx    # API calls / mutations (write-side; the functions that hit endpoints).
└── query.tsx     # TanStack Query hooks (read-side useQuery, query keys, options).
```

Rules:
- **Types live in `model.tsx` (MANDATORY).** Every type/interface belongs in the `model.tsx` of
  the component or module that owns it (the same folder as its `index.tsx`). **Never create a
  central `src/types/` folder** or a standalone `*.ts` types file. A non-component module (e.g.
  `src/auth/`) follows the same rule — its types go in that module's `model.tsx`. Import types from
  elsewhere via the owning folder (`@/auth/model`, `@/components/feature/<Name>/model`).
- **Extensions:** all files use the `.tsx` extension (project preference for uniform naming), even the non-JSX ones (`model`/`helper`/`constant`/`action`/`query`).
- **Split only when warranted:** a trivial component stays a single `index.tsx`. Move a concern into its own file once it materially exists — types → `model.tsx`, pure logic → `helper.tsx`, constants → `constant.tsx`, endpoint calls → `action.tsx`, TanStack Query hooks → `query.tsx`. `index.tsx` imports from its siblings.
- **Import within the folder** via relative paths (`./model`, `./helper`, …); import the component from elsewhere via the folder (`@/components/feature/<ComponentName>`), which resolves to its `index.tsx`.
- This layers **on top of** the directory rules above: `ui/` folders stay presentation-only (typically just `index.tsx`, maybe `model.tsx`); `feature/` folders and routed `pages/<Name>/` folders are where `helper`/`action`/`query` splits usually appear.

### shadcn/ui

Configured via `components.json` (style `default`, base color `slate`, CSS variables, global stylesheet `src/global.css`). Aliases: `ui` → `@/components/ui`, `utils` → `@/utils/cn`. The `hooks` alias maps to `@/hooks`, but no `hooks/` directory exists yet — create it when the first hook is added.

## Conventions

- Prettier formats the codebase (`.prettierrc.json`); run `npm run format` before committing.
- ESLint flat config (`eslint.config.js`) extends recommended JS/TS + react-hooks + react-refresh, with `eslint-config-prettier` last. Custom rules: 2-space `indent` and `no-tabs` are **errors**.
- Tailwind CSS v4 is wired through the `@tailwindcss/vite` plugin (no `tailwind.config.js`).
