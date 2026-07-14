// PostToolUse hook: lint (eslint --fix) + format (prettier --write) the edited file.
// Reads the Claude Code hook JSON from stdin, extracts the edited file path,
// and runs eslint + prettier on it if it's a lintable/formattable file.
// Exits 0 always (non-blocking) — a formatting failure should never halt the agent.
import { spawnSync } from 'node:child_process'

let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let file
  try {
    const j = JSON.parse(raw)
    file = j?.tool_response?.filePath || j?.tool_input?.file_path
  } catch {
    process.exit(0)
  }
  if (!file || !/\.(ts|tsx|js|jsx|json|css)$/.test(file)) process.exit(0)

  const isCode = /\.(ts|tsx|js|jsx)$/.test(file)
  const run = (bin, args) =>
    spawnSync(bin, args, { stdio: 'inherit', shell: true, cwd: process.cwd() })

  // ESLint only handles JS/TS; Prettier handles all of the above.
  if (isCode) run('npx', ['eslint', '--fix', file])
  run('npx', ['prettier', '--write', file])

  process.exit(0)
})
