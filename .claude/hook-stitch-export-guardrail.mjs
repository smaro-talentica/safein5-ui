// PostToolUse guardrail hook: enforce SafeIn5 UI conventions on Stitch exports.
//
// Scope: only files written under `stitch-export/`. Every other write is ignored,
// so this never interferes with normal editing of src/.
//
// It scans the just-written file for convention violations that the repo's
// eslint/prettier hook does NOT catch:
//   - inline `style={{ ... }}`            (must use Tailwind)
//   - hardcoded hex colors in className    (must use shadcn theme tokens)
//   - desktop-first breakpoints            (max-* widths / max-width media => not mobile-first)
//   - className string literals not routed through cn()  (advisory)
//   - missing `@/utils/cn` import when className is used  (advisory)
//
// Decision protocol (Claude Code PostToolUse):
//   - print JSON with hookSpecificOutput.additionalContext + a non-empty `decision`
//     of "block" to surface findings back to the agent; exit 0.
//   - exit 0 with no output => silent pass.
//
// This is a GUARDRAIL, not a formatter: it reports, it does not rewrite. It fails
// OPEN (a scanner bug must never wedge the workflow) — any error => silent pass.

import { readFileSync } from 'node:fs';

function basename(p) {
  return String(p).split(/[/\\]/).pop() || '';
}

// Is this path inside the stitch-export/ staging folder?
function isStitchExport(p) {
  if (!p) return false;
  const norm = String(p).replace(/\\/g, '/');
  return /(^|\/)stitch-export\/[^/]+\.(tsx|jsx)$/i.test(norm);
}

// Return an array of human-readable violation strings for the given source.
function scan(src) {
  const problems = [];
  const lines = src.split(/\r?\n/);

  // Strip line comments so a comment mentioning "style" doesn't false-positive.
  const codeOf = (line) => line.replace(/\/\/.*$/, '');

  let usesClassName = false;
  let importsCn = /from\s+["']@\/utils\/cn["']/.test(src);

  lines.forEach((rawLine, i) => {
    const line = codeOf(rawLine);
    const n = i + 1;

    // 1. inline style object
    if (/\bstyle=\{\{/.test(line)) {
      problems.push(`L${n}: inline \`style={{…}}\` — use Tailwind classes via cn() instead.`);
    }

    // 2. hardcoded hex color anywhere in the line (className, style, etc.)
    const hex = line.match(/#[0-9a-fA-F]{3,8}\b/);
    if (hex) {
      problems.push(
        `L${n}: hardcoded color "${hex[0]}" — use shadcn theme tokens (bg-primary, text-foreground, …).`
      );
    }

    // 3. desktop-first breakpoints: max-width Tailwind variants (max-sm:, max-md:, …)
    if (/\bmax-(sm|md|lg|xl|2xl):/.test(line)) {
      problems.push(
        `L${n}: \`max-*:\` breakpoint — author mobile-first with min-width variants (sm:/md:/lg:) instead.`
      );
    }
    // desktop-first raw media query
    if (/max-width\s*:/.test(line)) {
      problems.push(`L${n}: \`max-width\` media query — mobile-first uses min-width.`);
    }

    if (/className=/.test(line)) {
      usesClassName = true;
      // 4. className with a static string literal not wrapped in cn(): advisory.
      //    Matches className="..." or className={'...'} but not className={cn(...)}.
      if (/className=("[^"]*"|'[^']*'|\{\s*["'][^"']*["']\s*\})/.test(line) && !/\bcn\s*\(/.test(line)) {
        problems.push(
          `L${n}: className not composed via cn() — wrap classes in cn() from @/utils/cn.`
        );
      }
    }
  });

  // 5. uses className but never imports cn — advisory (single, file-level).
  if (usesClassName && !importsCn) {
    problems.push(`File uses className but does not import cn from "@/utils/cn".`);
  }

  return problems;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file;
  try {
    const j = JSON.parse(raw);
    file = j?.tool_response?.filePath || j?.tool_input?.file_path;
  } catch {
    process.exit(0); // fail open
  }

  try {
    if (!isStitchExport(file)) process.exit(0);

    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      process.exit(0); // file not readable => nothing to check
    }

    const problems = scan(src);
    if (problems.length === 0) process.exit(0);

    const report =
      `stitch-export guardrail — "${basename(file)}" has ${problems.length} convention ` +
      `issue(s) to fix before hand-placing into src/:\n` +
      problems.map((p) => `  • ${p}`).join('\n');

    // Surface findings back to the agent without hard-failing the write.
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: report,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: report,
        },
      }) + '\n'
    );
    process.exit(0);
  } catch {
    process.exit(0); // fail open — a guardrail bug must not wedge the workflow
  }
});
