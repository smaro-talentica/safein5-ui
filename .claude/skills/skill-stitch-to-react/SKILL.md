---
name: stitch-to-react
description: Turn a UX design (Stitch project/screen, an image, or a textual description) into a mobile-first React component for this codebase (React 19 + TypeScript + Tailwind v4 + shadcn/ui). Drives the Stitch MCP to produce/fetch the design, delegates conversion to the stitch-ui-designer sub-agent for context isolation, and writes a clean .tsx to stitch-export/ for the human to review and hand-place. Use when someone says "design this UI", "convert this UX/Stitch/mockup to a component", or hands over a screenshot/description to build from.
---

# stitch-to-react

Team workflow for converting UX → UI as a React component, mobile-first, using the
SafeIn5 UI stack. The generated file lands in `stitch-export/` as a **staging artifact**
— a human reviews it and moves it into `src/` at the right layer.

## When to use

- A teammate provides a **Stitch** project/screen, a **screenshot/image**, or a
  **textual description** of a screen or component, and wants a React starting point.
- Triggers: "design the UI from this UX", "convert this Stitch screen", "build this
  mockup as a component", "turn this description into a mobile-first component".

## Prerequisites (check once, up front)

- The **Stitch MCP** must be authorized. If a Stitch tool call fails on auth, tell the
  user to authorize it in an interactive session (`/mcp`) and stop — do not fake the
  design.
- `stitch-export/` is the output folder (created on first run).

## Steps

1. **Gather the input.** Determine which of the three you have:
   - *Image* → confirm the file path exists.
   - *Stitch reference* → note the project/screen id.
   - *Text* → the description itself.
   If the input is ambiguous or missing (e.g. "design the login screen" with no detail),
   ask **one** concise clarifying question before proceeding — not a barrage.

2. **Delegate to the sub-agent.** Spawn the **`stitch-ui-designer`** agent (via the Agent
   tool, `subagent_type: "stitch-ui-designer"`) with a prompt that includes:
   - the input (image path / Stitch id / full description),
   - the target component name if the user specified one,
   - a reminder that output goes to `stitch-export/<Name>.tsx` and must be mobile-first
     and convention-compliant.
   The sub-agent drives Stitch, converts to React, and writes the file. Running it as a
   sub-agent keeps large images and generated markup out of the main context.

3. **Report back.** Relay the sub-agent's report to the user: component name, the
   `stitch-export/<Name>.tsx` path, assumed shadcn primitives, suggested placement, and
   any TODOs. The `stitch-export-guardrail` hook will have already flagged any convention
   violations at write time — surface those too if present.

4. **Do NOT auto-place the file.** Leave it in `stitch-export/`. Offer to hand-place it
   into `src/components/ui`, `src/components/feature`, or `src/pages/<Name>/` (registering
   the route in `src/AppRoute/index.tsx`) as a **separate, explicit** follow-up the user
   confirms.

## Conventions the output must honor

(The sub-agent enforces these; verify them when reporting.)

- **Mobile-first**: base styles for phone; layer up with `sm:`/`md:`/`lg:` min-width
  utilities only.
- **Tailwind only** via `cn()` from `@/utils/cn`; **no** inline `style={{}}`, **no**
  hardcoded hex colors — use shadcn theme tokens.
- **`cva`** for variant APIs (pattern: `src/components/ui/button.tsx`).
- shadcn/ui primitives from `@/components/ui/*`; note any that must be added.
- TypeScript: exported prop `interface`, `forwardRef` for low-level pieces, no `any`.
- 2-space indent, no tabs (ESLint errors otherwise); Prettier-formatted.

## Notes

- Formatting/linting of the written file is automatic — the repo's `format-and-lint`
  PostToolUse hook runs `eslint --fix` + `prettier --write` on every written `.tsx`.
- Convention checks (mobile-first, `cn()`, no inline styles/hex) are enforced by the
  `stitch-export-guardrail` PostToolUse hook, scoped to `stitch-export/`.
