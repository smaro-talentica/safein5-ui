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
]

// Basename looks like an env file: `.env`, `.env.local`, `.env.production`, ...
const ENV_BASENAME = /^\.env(\.[^/\\]*)?$/i

function basename(p) {
  return String(p).split(/[/\\]/).pop() || ''
}

// Is this path a protected (secret-bearing) env file?
function isProtectedEnvPath(p) {
  if (!p) return false
  const base = basename(p).toLowerCase()
  if (!ENV_BASENAME.test(base)) return false
  // Allow templates through.
  for (const suffix of TEMPLATE_SUFFIXES) {
    if (base === '.env' + suffix || base.endsWith(suffix)) return false
  }
  return true
}

// Does a shell command actually operate on a protected env file?
//
// The naive approach — match any `.env` substring anywhere in the command —
// produces false positives: `git commit -m "reword .env docs"` mentions `.env`
// inside a MESSAGE, not as a file operand, yet would be blocked.
//
// Fix: distinguish a `.env` used AS A FILE PATH from a `.env` that is just text
// inside a quoted string argument. We do this in two passes:
//   1. Bare (unquoted) tokens — `cat .env`, `.env > x`, `rm .env.prod` — always
//      scanned; an unquoted `.env` token is being used as a path.
//   2. Quoted segments — scanned ONLY when the entire quoted content is itself a
//      path (e.g. `cat ".env.production"`), i.e. no spaces. A quoted string that
//      contains spaces (a commit message, an echo line) is prose, not a path.
function commandHitsEnv(cmd) {
  if (!cmd) return null
  const s = String(cmd)

  // --- pass 2 first: inspect quoted segments, remember them, then blank them out. ---
  const quoteRe = /(['"`])((?:\\.|(?!\1).)*)\1/g
  let m
  while ((m = quoteRe.exec(s))) {
    const inner = m[2]
    // Only a quote whose whole content is a single path-like token counts as a
    // file operand. Prose (has whitespace) is ignored.
    if (!/\s/.test(inner) && isProtectedEnvPath(inner)) return inner
  }
  // Blank out every quoted segment so pass 1 never sees text inside quotes.
  const bare = s.replace(quoteRe, ' ')

  // --- pass 1: bare tokens, split on shell separators. ---
  const tokens = bare.match(/[^\s;|&()<>]*\.env[^\s;|&()<>]*/gi) || []
  for (const tok of tokens) {
    if (isProtectedEnvPath(tok)) return tok
  }
  return null
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
    }) + '\n',
  )
  process.exit(0)
}

function allow() {
  // No output + exit 0 => hook does not object; normal permission flow continues.
  process.exit(0)
}

// --- main -----------------------------------------------------------------

let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let evt
  try {
    evt = JSON.parse(raw)
  } catch {
    // FAIL CLOSED: unparseable input -> block.
    deny('env-protector: could not parse hook input; blocking to stay safe.')
    return
  }

  try {
    const tool = evt?.tool_name
    const input = evt?.tool_input ?? {}

    // Defensive: a file path can live in several fields across tools.
    const candidatePaths = [
      input.file_path,
      input.path,
      input.filePath,
      input.notebook_path,
    ].filter((v) => typeof v === 'string' && v)

    for (const p of candidatePaths) {
      if (isProtectedEnvPath(p)) {
        deny(
          `env-protector: access to secret-bearing env file "${basename(p)}" is blocked. ` +
            `Use a template (.env.example / .env.sample / .env.template / .env.defaults / .env.dist) instead.`,
        )
        return
      }
    }

    // Shell tools: scan the command string.
    if (tool === 'Bash' || tool === 'bash') {
      const cmd = input.command
      const hit = commandHitsEnv(cmd)
      if (hit) {
        deny(
          `env-protector: this command touches the secret-bearing env file "${basename(hit)}" and is blocked. ` +
            `Read a template instead, or ask the user to share the value directly.`,
        )
        return
      }
    }

    allow()
  } catch (err) {
    // FAIL CLOSED: any unexpected error -> block.
    deny('env-protector: internal error while evaluating the action; blocking to stay safe.')
  }
})
