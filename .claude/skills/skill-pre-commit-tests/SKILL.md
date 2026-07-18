---
name: pre-commit-tests
description: The single testing gate for the SafeIn5 UI codebase. Run this right BEFORE committing — it reviews the logical changes in the working tree (via the code-reviewer agent), adds meaningful test cases for the changed pure-logic code, fixes any broken tests (via the debugger agent), generates a coverage report, and leaves everything uncommitted for the developer to review and commit. Use when someone says "before I commit", "get this ready to commit", "test my changes", "add tests and coverage for what I changed", or wires a commit-time quality gate alongside prettier/eslint.
---

# pre-commit-tests

The **one** testing skill for this repo. It runs right before a commit and does, over the
**changed files in the working tree**, exactly three things:

1. **Understand the logical changes** — what behavior did the diff add or alter that a test
   should pin down? (Uses the `code-reviewer` agent.)
2. **Cover them** — author meaningful, behavior-asserting tests for the changed pure-logic;
   ensure the whole suite is green, fixing any broken tests at the root cause (uses the
   `debugger` agent).
3. **Generate coverage** — produce the coverage report so the developer sees the diff's
   coverage before committing.

It never commits — the developer reviews the diff and owns that gate. It uses only two
sub-agents: **`code-reviewer`** (read-only, to identify what's worth testing) and
**`debugger`** (write-controlled, to fix broken tests). Everything else (running Vitest,
authoring tests) this skill does directly.

## When to use

- "Before I commit / get this ready to commit / prep this for commit."
- "Test my changes" / "add tests and coverage for what I changed."
- Any commit-time gate meant to sit next to the prettier + eslint PostToolUse hook.

> A skill is invoked, not automatic. This runs when you (or the user) call it before a
> commit. If you want it enforced automatically on `git commit`, that is a separate
> `PreToolUse` hook on the Bash `git commit` command — not part of this skill.

## Test stack & environment (know before running)

- **Vitest 4 + jsdom + fake-indexeddb**, `globals: true`. Existing tests live **next to the
  source** (`src/**/foo.test.ts`), not in a `__tests__/` dir. Coverage runs via
  `@vitest/coverage-v8` (config in `vite.config.ts`).
- **Always run one-shot:** `npx vitest run` and `npx vitest run --coverage`. **Never**
  `npm test` — it is watch mode and hangs a non-interactive agent.
- **Node 24.17.0+** (pinned in `.nvmrc`). If tests fail at *collection* with
  `Cannot read properties of undefined (reading 'config')`, that's a Node-version
  mismatch — surface it and stop, don't author tests.

## Steps

### 1. Establish the diff

Run `git status --porcelain`. Build the changed-file list — added/modified files under
`src/**`, excluding deletions and the `*.test.*` files you are about to write. If nothing
under `src/` changed, report "no source changes to gate" and stop.

### 2. Identify the logical changes worth testing

Spawn the **`code-reviewer`** agent (Agent tool, `subagent_type: "code-reviewer"`, read-only)
scoped to the changed files. Ask it for the **behavioral changes** in the diff — new/changed
functions, branches, edge cases, error paths — i.e. what a test should lock down. Use its
report to drive step 3; don't test lines that carry no logic.

### 3. Author meaningful tests for the changed pure-logic

For each changed **pure-logic** file lacking adjacent coverage for its new behavior:

- **Scope of authoring = pure logic only:** `src/utils/**`, `helper.tsx`, `constant.tsx`
  maps worth asserting, non-React hook logic. React/DOM/browser-bound changes
  (`index.tsx`, real `MediaRecorder`/`getUserMedia`, `window` events) → **report as a
  deferred gap** (the repo has no `@testing-library/react`); do not force brittle tests.
- **Match the existing idiom exactly.** Study a current test first (`src/pages/shared/ScanQr/
  helper.test.ts` is a good example): co-locate `foo.ts → foo.test.ts`; `import { describe,
  expect, it, vi } from 'vitest'`; **inject/mock at the seam** (pass fakes like `() => 0`,
  mock `fetch` with `vi.fn()`); cover **happy + error + edge** branches, not one call.
  2-space indent, no tabs, no `any`.
- **Only logical test cases.** Every test asserts real behavior. Reject anything that only
  restates a constant as its own literal, snapshot-dumps to color lines, or weakens an
  assertion to pass. If a changed line cannot be covered by a meaningful test (unreachable
  defensive branch, DOM-only path), **leave it and say so** — never game the number.

### 4. Run the suite; fix red at the root cause

Run `npx vitest run`.

- **Green** → go to step 5.
- **Red** → spawn the **`debugger`** agent (`subagent_type: "debugger"`, write-controlled)
  with the failing-test details. It finds the root cause, applies the **smallest safe
  change**, and re-verifies. Never mask a failure to go green.
  - If a failure is **environmental/expected** (Node version, missing env) → surface it and
    stop; don't auto-edit.
  - If a newly authored test is simply wrong, fix the **test** (source is assumed correct at
    authoring time). If a new test exposes a genuine **source bug**, hand that specific fix
    to the `debugger` and report it — don't quietly change product logic under coverage.

### 5. Generate coverage

Run `npx vitest run --coverage`. Read `coverage/coverage-summary.json` for exact numbers.
Report coverage for the **changed files** (before → after where known) plus the overall
headline. `coverage/` is git-ignored — never commit it.

### 6. Report — then hand the commit to the human

Summarize: the logical changes covered, test files added (for which modules), any broken
test fixed (root cause + files touched), coverage for the diff, and any change deliberately
deferred (reason + tooling a follow-up would need). **Leave everything uncommitted** — the
developer reviews the diff and commits. This skill never commits, stages for commit, or
pushes.

## Boundaries

- **Diff-scoped and pre-commit.** Not a whole-repo coverage campaign.
- **Meaningful tests over green lines.** No `.skip`, no weakened assertions, no `any`, no
  snapshot padding, no chasing 100%.
- **Pure logic only for authoring.** Defers React/DOM tests rather than adopting a
  testing-library stack the repo hasn't chosen.
- **Two agents only:** `code-reviewer` (identify) and `debugger` (fix). Vitest is run
  directly by this skill.
- **Never commits or pushes.** The human owns that gate.
