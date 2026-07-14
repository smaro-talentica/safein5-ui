---
name: debug-tests
description: Project workflow for diagnosing and fixing failing tests with two scoped specialists — the read-only test-runner triages failures out of the main conversation, then the debugger applies the smallest safe fix and verifies it. Keeps long test logs and debugging churn isolated. Use when tests are failing, when someone says "tests are red / fix the failing tests / why is CI failing", or when a failure needs triage before a fix.
---

# debug-tests

Two-stage, context-isolated workflow for test failures in the SafeIn5 UI codebase. It
keeps long Vitest logs and debugging churn **out of the main development session** by
delegating to two specialist sub-agents with clearly separated permissions:

- **`test-runner`** — *read-only*. Runs/analyzes tests, distills long logs into a concise
  structured failure summary, localizes likely source files. Never edits.
- **`debugger`** — *write-controlled*. Consumes that summary, finds the root cause,
  applies the **smallest safe change**, runs targeted + full verification, reports the diff.

This is the separation the exercise calls for: analysis and code-modification are distinct
roles, each with the minimum permissions it needs, with an explicit handoff between them.

## When to use

- Tests are failing (`npm test` red, CI failing) and you want them triaged and/or fixed.
- Triggers: "fix the failing tests", "tests are red", "why is this test failing",
  "debug this test", "run the tests and fix what breaks".

## Steps (how the main session delegates)

1. **Triage — spawn `test-runner` (read-only).**
   Use the Agent tool with `subagent_type: "test-runner"`. Prompt it to run the relevant
   tests (`npx vitest run`, or a scoped file if the user named one) and return its **Test
   Run Summary** — failing tests, minimal log excerpts, likely source files, hypotheses.
   Running it as a sub-agent keeps the long raw log out of the main context; you receive
   only the distilled summary.

2. **Decision gate.**
   - If the summary says **all green**, report that and stop — nothing to fix.
   - If failures are **environmental / expected** (e.g. the user must run something,
     missing env), surface that to the user rather than auto-editing.
   - Otherwise continue to the fix stage.

3. **Fix — spawn `debugger` (write-controlled).**
   Use the Agent tool with `subagent_type: "debugger"`, passing the `test-runner`'s
   **full Test Run Summary verbatim** as input. The debugger reproduces, finds the root
   cause, applies the smallest safe change, verifies (targeted test → full suite →
   `tsc` if types were touched), and returns its **Diagnosis / Change / Verification**
   report. It leaves the change in the working tree — it does NOT commit.

4. **Report back & confirm.**
   Relay the debugger's report to the user: root cause, files touched, verification
   result. Because the fix is left uncommitted in the working tree, the developer reviews
   the diff and decides whether to keep/commit it. Offer a re-run via `test-runner` if
   they want independent confirmation.

## Boundaries & permissions (by design)

- **test-runner**: tools `Read, Grep, Glob, Bash`; Bash restricted to running tests and
  read-only inspection. It cannot Edit/Write. Analysis only.
- **debugger**: tools `Read, Grep, Glob, Bash, Edit, Write`. May modify code, but under a
  strict charter — smallest safe change, in-scope files only, no masking failures, no
  commit/push/branch. Large/risky fixes are reported as a plan instead of applied.
- Neither agent commits or pushes; the human owns that gate.

## Notes

- `npm test` is **watch mode** and hangs non-interactive agents — both agents use
  `npx vitest run` (one-shot). Single file: `npx vitest run <path>`; by name:
  `npx vitest run -t "<name>"`.
- Test stack: Vitest 4 + jsdom + fake-indexeddb. Current test files live under
  `src/` (e.g. `src/utils/upload/*.test.ts`) — the agents discover them, don't hardcode.
- You can also invoke either agent alone: `test-runner` for pure triage (no fix), or
  `debugger` when a failure is already understood and just needs a controlled fix.
