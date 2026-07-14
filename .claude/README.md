# `.claude/` — Team Claude Code Tooling

This directory holds the **shared** Claude Code configuration for SafeIn5 UI —
skills, sub-agents, hooks, and the MCP server config. Everything here is checked into
the repo (via explicit allowlist entries in the root `.gitignore`) so every teammate
gets the same setup automatically.

File-naming convention: artifacts are prefixed by type — `skill-*` (skill directories),
`sub-agent-*` (agent files), `hook-*` (hook scripts). All shared artifacts follow this
convention.

> **Scope of this document.** It lists only **project-shared** tooling committed to this
> repo. Individual developers may *additionally* have **user-level** skills/agents in
> their own `~/.claude/` (e.g. personal `git-commit`, `vite-bootstrap` helpers) and the
> **built-in** skills that ship with Claude Code (`deep-research`, `dataviz`,
> `code-review`, `run`, …). Those are per-machine and not shared here, so they are
> intentionally out of scope — run `/help` or check your `~/.claude/` to see what else
> is available to you locally.

---

## Skills

Invoked explicitly with a slash command. The invocation name comes from the skill's
directory / `name:` frontmatter, **not** the folder's `skill-` prefix.

| Skill | Invoke | Purpose |
| --- | --- | --- |
| `skills/skill-stitch-to-react/` | `/stitch-to-react` | Turn a UX design (Stitch screen, image, or textual description) into a **mobile-first** React component for this stack. Drives the Stitch MCP, delegates conversion to the `stitch-ui-designer` sub-agent, and writes the result to `stitch-export/<Name>.tsx` for human review and hand-placement. |
| `skills/skill-pre-commit-tests/` | `/pre-commit-tests` | The single testing gate, run right before a commit. Reviews the logical changes in the working tree (via the `code-reviewer` sub-agent), authors meaningful tests for the changed pure-logic, fixes any broken tests (via the `debugger` sub-agent), generates the coverage report, and leaves everything uncommitted for the developer to review. |

## Sub-agents

Context-isolated workers. The `subagent_type` used to spawn them comes from the `name:`
frontmatter, not the filename.

| File | `subagent_type` | Purpose |
| --- | --- | --- |
| `agents/sub-agent-stitch-ui-designer.md` | `stitch-ui-designer` | Converts UX → mobile-first React. Enforces Tailwind-only styling via `cn()`, `cva` for variants, shadcn theme tokens (no inline styles / hex), and TypeScript conventions. Writes to `stitch-export/`. |
| `agents/sub-agent-code-reviewer.md` | `code-reviewer` | Read-only reviewer: correctness, React/hooks pitfalls, type safety, accessibility, and project-convention adherence. Never edits files. |
| `agents/sub-agent-debugger.md` | `debugger` | **Write-controlled** fixer. Consumes a failing-test summary, finds root cause, applies the smallest safe change, runs targeted + full verification, reports the diff. Never commits/pushes. |

## Hooks

Configured in `settings.json` and run automatically by the harness on specific events.

| Event (matcher) | Script | What it does |
| --- | --- | --- |
| **PreToolUse** (`Read\|Edit\|Write\|Bash`) | `hook-protect-env.mjs` | Blocks access to secret-bearing `.env` files; allows templates. Fails **closed**. |
| **PostToolUse** (`Edit\|Write`) | `hook-format-and-lint.mjs` | Runs `eslint --fix` + `prettier --write` on every written `.ts/.tsx/.js/.jsx/.json/.css` file. |
| **PostToolUse** (`Edit\|Write`) | `hook-stitch-guardrail.mjs` | Guardrail scoped to `stitch-export/`: flags inline `style={{}}`, hardcoded hex colors, desktop-first (`max-*`) breakpoints, and classNames not composed via `cn()`. Fails **open**. |
| **Stop** | `hook-readme-sync.mjs` | Checks that README/docs stay in sync with changed source files. |

## MCP servers

Configured in the repo-root `.mcp.json`.

| Name | Type | Endpoint | Auth |
| --- | --- | --- | --- |
| `stitch` | http | `https://stitch.googleapis.com/mcp` | Header `X-Goog-Api-Key: ${STITCH_API_KEY}` — set `STITCH_API_KEY` in your environment. |

---

## The stitch-to-react workflow at a glance

```
UX input (Stitch screen / image / text)
        │
        ▼
  /stitch-to-react            ← skill: gathers input, delegates, reports
        │
        ▼
  stitch-ui-designer          ← sub-agent: drives Stitch MCP, converts to React
        │
        ▼
  stitch-export/<Name>.tsx    ← staging artifact (NOT auto-placed into src/)
        │
        ├─ hook-format-and-lint.mjs       (eslint + prettier)
        └─ hook-stitch-guardrail          (convention checks)
        │
        ▼
  human review → hand-place into src/components/ui | feature | pages/<Name>/
```

Output is intentionally left in `stitch-export/` for a human to review and move into
`src/` at the correct layer — the workflow never auto-places components.
