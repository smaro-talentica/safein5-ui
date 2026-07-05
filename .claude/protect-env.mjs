// PreToolUse guardrail hook: protect secret-bearing env files from the agent.
//
// Blocks:
//   - READING real env files      (Read tool)
//   - MODIFYING/CREATING/DELETING (Edit / Write tools)
//   - `cat .env` & friends        (Bash tool — inspects the command string)
//
// Allows the safe, non-secret templates:
//   .env.example  .env.sample  .env.template  .env.defaults  .env.dist
//
// Decision protocol (Claude Code PreToolUse):
//   - print a JSON object with hookSpecificOutput.permissionDecision = "deny"
//     and exit 0  -> the tool call is blocked, the reason is shown to the agent.
//   - exit 0 with no output                                 -> allow (fall through).
//
// SECURITY: this hook FAILS CLOSED. Any parse error / unexpected shape blocks the
// action rather than silently allowing it. A guardrail that crashes open is no guardrail.

// --- patterns -------------------------------------------------------------

// A path segment is a real env file if it starts with `.env` and is NOT one of
// the allowlisted templates. We test the basename (last path segment).
const TEMPLATE_SUFFIXES = [
  '.example',
  '.sample',
  '.template',
  '.defaults',
  '.dist',
  '.local.example', // e.g. .env.local.example — still a template
];

// Basename looks like an env file: `.env`, `.env.local`, `.env.production`, ...
const ENV_BASENAME = /^\.env(\.[^/\\]*)?$/i;

function basename(p) {
  return String(p).split(/[/\\]/).pop() || '';
}

// Is this path a protected (secret-bearing) env file?
function isProtectedEnvPath(p) {
  if (!p) return false;
  const base = basename(p).toLowerCase();
  if (!ENV_BASENAME.test(base)) return false;
  // Allow templates through.
  for (const suffix of TEMPLATE_SUFFIXES) {
    if (base === '.env' + suffix || base.endsWith(suffix)) return false;
  }
  return true;
}

// Does a shell command touch a protected env file?
// We look for `.env` tokens in the command and check each against the allowlist.
function commandHitsEnv(cmd) {
  if (!cmd) return null;
  // Grab every whitespace/quote/redirect-delimited token that contains `.env`.
  const tokens = String(cmd).match(/[^\s'"`;|&()<>]*\.env[^\s'"`;|&()<>]*/gi) || [];
  for (const tok of tokens) {
    // Strip surrounding quotes/backticks that slipped in.
    const clean = tok.replace(/^['"`]+|['"`]+$/g, '');
    if (isProtectedEnvPath(clean)) return clean;
  }
  return null;
}

// --- decision helpers -----------------------------------------------------

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }) + '\n'
  );
  process.exit(0);
}

function allow() {
  // No output + exit 0 => hook does not object; normal permission flow continues.
  process.exit(0);
}

// --- main -----------------------------------------------------------------

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    // FAIL CLOSED: unparseable input -> block.
    deny('env-protector: could not parse hook input; blocking to stay safe.');
    return;
  }

  try {
    const tool = evt?.tool_name;
    const input = evt?.tool_input ?? {};

    // Defensive: a file path can live in several fields across tools.
    const candidatePaths = [
      input.file_path,
      input.path,
      input.filePath,
      input.notebook_path,
    ].filter((v) => typeof v === 'string' && v);

    for (const p of candidatePaths) {
      if (isProtectedEnvPath(p)) {
        deny(
          `env-protector: access to secret-bearing env file "${basename(p)}" is blocked. ` +
            `Use a template (.env.example / .env.sample / .env.template / .env.defaults / .env.dist) instead.`
        );
        return;
      }
    }

    // Shell tools: scan the command string.
    if (tool === 'Bash' || tool === 'bash') {
      const cmd = input.command;
      const hit = commandHitsEnv(cmd);
      if (hit) {
        deny(
          `env-protector: this command touches the secret-bearing env file "${basename(hit)}" and is blocked. ` +
            `Read a template instead, or ask the user to share the value directly.`
        );
        return;
      }
    }

    allow();
  } catch (err) {
    // FAIL CLOSED: any unexpected error -> block.
    deny('env-protector: internal error while evaluating the action; blocking to stay safe.');
  }
});
