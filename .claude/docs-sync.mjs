// Stop hook: keep documentation in sync with code automatically.
//
// Cadence: fires when the agent thinks it has FINISHED a turn (Stop event).
//
// What it does (PURE SHELL / DETERMINISTIC — no AI in this hook):
//   1. LOOP-GUARD (two layers): never continue more than once for the same set of
//      changes — see the note below on why one layer is not enough.
//   2. `git status` (staged + unstaged + untracked) to see which files changed.
//   3. Check whether known doc files exist in the working dir
//      (README.md, architecture.md, api-spec.md).
//   4. If SOURCE files changed AND relevant docs exist, return a "block" decision
//      whose `reason` is a follow-up instruction. Claude Code feeds that reason
//      back into the SAME running session (it does NOT spawn a new agent) — the
//      model's intelligence then actually reviews and rewrites the docs.
//
// Intelligence split:
//   - deterministic detection (git status, file existence, string building) = this hook
//   - actually editing the docs                                             = the model
//
// WHY TWO LOOP-GUARD LAYERS?
//   `stop_hook_active` is true only on the turn the block itself re-woke. But the
//   condition we detect ("source changed + docs exist") stays TRUE on every later
//   turn until the changes are committed — and the model editing a doc during the
//   continuation produces a fresh, normal turn where the flag no longer applies.
//   So `stop_hook_active` alone lets the hook fire again and again.
//   The durable fix is a state file keyed to the CURRENT changeset: once we have
//   prompted for a given set of changed source files, we do not prompt again for
//   that same set. It self-clears automatically when the changeset changes.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Doc files we care about keeping in sync.
const DOC_FILES = ['README.md', 'architecture.md', 'api-spec.md'];

// A changed path counts as "source" if it is NOT itself a doc file and looks
// like code/config the docs might describe.
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|html|py|go|rs|java)$/i;

// Durable marker: the changeset we have already prompted for.
const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), '.docs-sync-state');

function proceed() {
  // Exit 0 with no decision => allow the agent to stop normally.
  process.exit(0);
}

function forceContinue(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  process.exit(0);
}

// Collect files changed in the working tree: staged, unstaged, and untracked.
function changedFiles() {
  const out = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { encoding: 'utf8', cwd: process.cwd() }
  );
  if (out.status !== 0 || !out.stdout) return [];
  return out.stdout
    .split('\n')
    .map((line) => line.slice(3).trim()) // strip the 2-char status + space
    .filter(Boolean)
    // handle rename lines "old -> new": keep the new path
    .map((p) => (p.includes('->') ? p.split('->').pop().trim() : p))
    // strip surrounding quotes git adds for paths with spaces
    .map((p) => p.replace(/^"|"$/g, ''));
}

// A stable fingerprint of the current changed-source set (order-independent).
function fingerprint(paths) {
  return createHash('sha1').update([...paths].sort().join('\n')).digest('hex');
}

function alreadyPrompted(fp) {
  try {
    return readFileSync(STATE_FILE, 'utf8').trim() === fp;
  } catch {
    return false; // no state file yet
  }
}

function remember(fp) {
  try {
    writeFileSync(STATE_FILE, fp);
  } catch {
    // If we can't persist, we fall back to the stop_hook_active guard below.
  }
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let evt = {};
  try {
    evt = JSON.parse(raw) || {};
  } catch {
    // If we can't read the event, don't trap the agent in a loop — let it stop.
    proceed();
    return;
  }

  // LOOP-GUARD layer 1: the turn we ourselves re-woke. Cheap early bail.
  if (evt.stop_hook_active) {
    proceed();
    return;
  }

  // (2) Detect changes deterministically.
  const changed = changedFiles();
  const changedSource = changed.filter(
    (p) => SOURCE_RE.test(p) && !DOC_FILES.includes(p.split(/[/\\]/).pop())
  );

  if (changedSource.length === 0) {
    proceed(); // no code changed -> nothing to document
    return;
  }

  // (3) Do the relevant docs actually exist?
  const existingDocs = DOC_FILES.filter((d) => existsSync(d));
  if (existingDocs.length === 0) {
    proceed(); // no docs to update
    return;
  }

  // LOOP-GUARD layer 2 (the durable one): have we already prompted for THIS
  // exact set of changed source files? If so, do not prompt again — this is what
  // makes it "exactly once per changeset" instead of "once per re-wake". The
  // marker self-clears the moment the changed-source set differs.
  const fp = fingerprint(changedSource);
  if (alreadyPrompted(fp)) {
    proceed();
    return;
  }
  remember(fp);

  // (4) Force the SAME session to continue once, with a concrete instruction.
  const fileList = changedSource.slice(0, 20).join(', ');
  const reason =
    `Documentation-sync check: you changed source files (${fileList}) but did not ` +
    `confirm the docs are still accurate. Review these doc files and update ONLY the ` +
    `sections affected by those changes: ${existingDocs.join(', ')}. ` +
    `In particular, make sure any new user-facing feature, route, page, script, ` +
    `environment variable, or dependency is reflected. If a doc is already accurate, ` +
    `say so explicitly and make no edit. Do not create new docs and do not touch ` +
    `unrelated sections. This is an automated one-time reminder — after this pass you may stop.`;

  forceContinue(reason);
});
