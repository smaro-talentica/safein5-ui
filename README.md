# SafeIn5 UI

A React + TypeScript single-page app built with Vite, with PWA support.

## Features
- **Video upload** (`/upload`) — a mobile-friendly screen to select a video (tap or drag & drop), preview it, and upload with progress. Accepts MP4/MOV up to 500MB. Implemented as the `VideoUpload` feature component (`src/components/feature/VideoUpload/`) rendered by the `UploadVideo` page (`src/pages/UploadVideo/`). The upload handler is currently mocked — wire `onUpload` to a real API.

## Getting Started

### Prerequisites
- **Node.js** `>=24.17.0` (the version is pinned in `.nvmrc` — run `nvm use` to match)
- **npm** `>=11.13.0`

Versions are enforced via the `engines` field in `package.json`.

### Recommended editor setup
When you open this project in VS Code, you'll be prompted to install the recommended extensions (defined in `.vscode/extensions.json`):
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Code Spell Checker

### Install
```bash
npm install
```

### Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server in **development** mode (HTTPS via basic-ssl, HMR) |
| `npm run dev:stage` | Start the dev server in **staging** mode |
| `npm run dev:prod` | Start the dev server in **production** mode |
| `npm run build` | Type-check (`tsc -b`) and build for **production** |
| `npm run build:dev` | Build for **development** |
| `npm run build:stage` | Build for **staging** |
| `npm run preview` | Preview the last production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm test` | Run unit tests with Vitest |

## Environments
The app supports three environments, each driven by a Vite **mode** and its matching env file:

| Environment | Mode | Env file | Dev | Build |
| --- | --- | --- | --- | --- |
| Development | `development` | `.env.development` | `npm run dev` | `npm run build:dev` |
| Staging | `staging` | `.env.staging` | `npm run dev:stage` | `npm run build:stage` |
| Production | `production` | `.env.production` | `npm run dev:prod` | `npm run build` |

- Variables follow Vite conventions and **must be prefixed with `VITE_`** to be exposed to the client.
- See `.env.example` for the full list of supported variables. Use `.env.local` / `.env.<mode>.local` for machine-specific overrides and secrets (git-ignored).
- Typed access is centralized in `src/utils/env.ts` (`env`, `isDevelopment`, `isStaging`, `isProduction`); types are declared in `src/vite-env.d.ts`.
- The dev server runs over HTTPS in all modes via `@vitejs/plugin-basic-ssl`.

Available variables:

| Variable | Description |
| --- | --- |
| `VITE_APP_ENV` | Current environment: `development` \| `staging` \| `production` |
| `VITE_API_BASE_URL` | Base URL for API requests |

## PWA Support
This app is an installable Progressive Web App, configured via `vite-plugin-pwa`:
- Auto-updating service worker (`registerType: 'autoUpdate'`)
- Web app manifest (standalone display, theme/background colors, 192/512 icons incl. maskable)
- Offline asset precaching via Workbox (`js`, `css`, `html`, `ico`, `png`, `svg`, `woff2`)

## Project Structure
```
src/
├── AppRoute/        App routing
├── assets/          Static assets
├── components/      Reusable components
│   ├── ui/          Presentational components — styling only, no logic (incl. shadcn/ui)
│   └── feature/     Reusable components with styling AND logic
├── pages/           Page components
├── utils/           Utilities (cn, env helpers) — @/utils
├── main.tsx         App entry point
├── global.css       Global styles
└── vite-env.d.ts    Vite/PWA + env type declarations
```

The `@` alias resolves to `src/`.

### Component conventions
- **`components/ui/`** — purely presentational, reusable building blocks. Styling only, **no business logic** or state (buttons, inputs, cards, etc.). This is where shadcn/ui components live.
- **`components/feature/`** — reusable components that combine **styling and logic** (data fetching, state, behavior) for a specific feature.

## Technologies

### Core
- React
- React DOM
- TypeScript
- Vite

### Routing & Data
- React Router DOM
- TanStack React Query
- TanStack React Query Devtools

### Forms
- React Hook Form

### Styling & UI
- Tailwind CSS
- shadcn/ui
- Lucide React
- class-variance-authority
- clsx
- tailwind-merge

### Build & Plugins
- @vitejs/plugin-react
- @vitejs/plugin-basic-ssl
- @tailwindcss/vite
- vite-plugin-checker
- vite-plugin-pwa

### Tooling
- ESLint
- typescript-eslint
- Prettier
- Vitest
- jsdom
