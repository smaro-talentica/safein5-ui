// UserPromptSubmit hook: append each submitted prompt to .claude/prompt.jsonl (JSONL).
// The submitted text may have harness-injected context (e.g. <ide_opened_file>...)
// prepended to what the user typed. We split them:
//   - system_prompt: the auto-added leading tag block(s), joined (empty if none)
//   - prompt:        the user's actual typed text (with those blocks removed)
// Append-only: no read-modify-write, so concurrent prompts can't clobber the log.
// Exits 0 always (non-blocking) — a logging failure should never halt the agent.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outFile = join(dirname(fileURLToPath(import.meta.url)), 'prompt.jsonl');

// Peel leading whole-tag blocks like <tag ...>...</tag> (and stray whitespace)
// off the front of the text. Whatever remains is the user's typed prompt.
function splitInjectedContext(text) {
  const system = [];
  let rest = text;
  // Match a leading <tag>...</tag> block, tolerating leading whitespace.
  const blockRe = /^\s*(<([A-Za-z][\w-]*)\b[^>]*>[\s\S]*?<\/\2>)\s*/;
  let m;
  while ((m = blockRe.exec(rest))) {
    system.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return { system_prompt: system.join('\n'), prompt: rest };
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let submitted;
  try {
    const j = JSON.parse(raw);
    submitted = j?.prompt;
  } catch {
    process.exit(0);
  }
  if (typeof submitted !== 'string') process.exit(0);

  const { system_prompt, prompt } = splitInjectedContext(submitted);

  const line = JSON.stringify({
    prompt,
    system_prompt,
    timestamp: new Date().toISOString(),
  });
  try {
    appendFileSync(outFile, line + '\n');
  } catch {
    // ignore write errors — never block the agent
  }
  process.exit(0);
});
