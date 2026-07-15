# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

@AGENTS.md

## Project

SafeIn5 UI (package `fe-fastin5`, PWA "Fast in 5") — an installable PWA with two flows: a
camera-backed **QR scanner** that reads a JSON payload and reroutes on it, and a **video
capture/upload** screen that records or picks a video and stores it **locally in IndexedDB**
(no server yet). See [README.md](README.md) for the full feature spec.

**Stack:** React 19 + TypeScript, Vite, Tailwind CSS v4 (+ shadcn/ui, `cva`, `cn`), TanStack
Query, react-router-dom v7, react-hook-form, `@zxing` (QR), vite-plugin-pwa. Node `>=24.17.0`,
npm `>=11.13.0` (pinned in `.nvmrc`, enforced via `engines` + `engine-strict`).

## Commands

```bash
npm run dev          # dev server (development mode; HTTPS via basic-ssl, HMR)
npm run dev:stage    # dev server, staging mode      (dev:prod for production mode)
npm run build        # tsc -b type-check + vite build (build:dev / build:stage for other modes)
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest (watch)
npm run preview      # serve last production build
```

Single test: `npx vitest run <file>` or `npx vitest run -t "<name>"`. Type-checking also runs
live in dev (`vite-plugin-checker`) and `tsc -b` gates every build.

## Environments

Vite **mode** + matching env file: `development`/`staging`/`production` → `.env.<mode>`.
Client vars **must be `VITE_`-prefixed**; use `.env.local` / `.env.<mode>.local` for secrets.
Access env **only** through `src/utils/env.ts` (`env`, `isDevelopment`, `isStaging`,
`isProduction`) — never `import.meta.env` in a component. Add new vars there and to
`ImportMetaEnv` in `src/vite-env.d.ts`.

## Architecture

- **Entry** (`src/main.tsx`): `<AppRoute />` inside `QueryClientProvider`, wrapped in `StrictMode`.
- **Routing** (`src/AppRoute/index.tsx`): one `createBrowserRouter` with a `RootLayout` (nav +
  `<Outlet />`) and child routes. **Every routed component lives at `src/pages/<Name>/index.tsx`**;
  register it here.
- **`@` alias** → `src/` (in `vite.config.ts` + `tsconfig.app.json`).

### Component layers (enforced by directory)

- `src/components/ui/` — presentational only. **Styling, no logic/state.** shadcn/ui lands here.
- `src/components/feature/` — styling **and** logic (data, state, behavior).
- Style via `cn()` (`@/utils/cn`); `cva` for variants — see `src/components/ui/button.tsx`.

### Component folder structure

Each scaffolded component is a folder. `index.tsx` (render + wiring) is always present; add a
sibling **only when that concern exists** — no empty placeholders. All files use `.tsx`.

| File           | Holds                                   |
| -------------- | --------------------------------------- |
| `model.tsx`    | types/interfaces (props, domain shapes) |
| `helper.tsx`   | pure, framework-agnostic logic          |
| `constant.tsx` | constants/config/static maps            |
| `action.tsx`   | mutations / write-side API calls        |
| `query.tsx`    | TanStack Query hooks + keys             |

Import siblings by relative path (`./model`); import the component elsewhere via the folder
(`@/components/feature/<Name>`). `ui/` folders stay presentation-only; `feature/` and
`pages/<Name>/` are where the splits usually appear.

### shadcn/ui

`components.json` (style `default`, base `slate`, CSS vars, `src/global.css`). Aliases: `ui` →
`@/components/ui`, `utils` → `@/utils/cn`, `hooks` → `@/hooks` (create the dir on first hook).

## Conventions

- **No code comments** — self-explanatory names instead. Only exception: required tooling
  directives (`eslint-disable-*`, `@ts-expect-error`).
- Prettier (`.prettierrc.json`) — run `npm run format` before committing.
- ESLint flat config extends recommended JS/TS + react-hooks + react-refresh, `prettier` last.
  **2-space `indent` and `no-tabs` are errors.**
- Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config.js`.

## Key decisions (and why)

- **TanStack Query for server state** (not Redux) — the app has no client-global UI state worth a
  store; needs are caching, dedup, and invalidation, which Query gives for free.
- **HTTPS in every dev mode** (`basic-ssl`) — the camera (`getUserMedia`) only works in a secure
  context, so on-device testing needs trusted HTTPS. See the phone-testing note in README.
- **Videos persist to IndexedDB, not a server** — there is no upload endpoint yet; storage is a
  local placeholder. Treat "upload" as a local save.
- **Concern-split component folders** — keeps `index.tsx` about rendering and isolates
  types/logic/data so files stay small and testable; the folder is the single import surface.
