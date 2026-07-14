# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

SafeIn5 UI (package name `fe-fastin5`, PWA name "Fast in 5") — a React 19 + TypeScript SPA built with Vite, with installable PWA support. Requires Node `>=24.17.0` and npm `>=11.13.0` (pinned in `.nvmrc` / enforced via `engines`).

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

- **Entry** (`src/main.tsx`): mounts `<AppRoute />` inside `QueryClientProvider` (TanStack React Query) wrapped in `StrictMode`. React Query Devtools are included.
- **Routing** (`src/AppRoute/index.tsx`): a single `createBrowserRouter` config with a `RootLayout` (nav + `<Outlet />`) and child routes. Add new routes here. **Every routed component must live under `src/pages/<Name>/index.tsx`** — only page-level components are routed, and they always come from `pages/`.
- **`@` alias** resolves to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

### Component conventions (enforced by directory)

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
