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

### shadcn/ui

Configured via `components.json` (style `default`, base color `slate`, CSS variables, global stylesheet `src/global.css`). Aliases: `ui` → `@/components/ui`, `utils` → `@/utils/cn`. The `hooks` alias maps to `@/hooks`, but no `hooks/` directory exists yet — create it when the first hook is added.

## Conventions

- Prettier formats the codebase (`.prettierrc.json`); run `npm run format` before committing.
- ESLint flat config (`eslint.config.js`) extends recommended JS/TS + react-hooks + react-refresh, with `eslint-config-prettier` last. Custom rules: 2-space `indent` and `no-tabs` are **errors**.
- Tailwind CSS v4 is wired through the `@tailwindcss/vite` plugin (no `tailwind.config.js`).
