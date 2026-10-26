// SPDX-License-Identifier: FSL-1.1-MIT

// PreToolUse hook: blocks a `git push` until HEAD has passed the pre-PR
// architecture review. See docs/agents/agent-tooling.md "The pre-push gate".

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `git push` in command position (line start, or after `;`, `&`, `|`, `(`, and
// optional `VAR=value` assignments), with optional global options
// (`git -C dir push`). A push quoted inside an argument, such as a commit
// message, does not match, nor do `git stash push` or `git commit -m "push"`.
const GIT_PUSH =
  /(?:^|[;&|(])\s*(?:\w+=\S*\s+)*git(?:\s+-{1,2}\S+(?:\s+[^\s-]\S*)?)*\s+push(?=$|[\s;&|)])/m;
const MARKER_FILE = 'arch-reviewed';
const BLOCKED_REASON =
  'Push blocked: HEAD has not passed the pre-PR architecture review. Follow AGENTS.md "Pre-PR Architecture Review", then push again.';

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function isHeadReviewed() {
  try {
    const marker = join(git('rev-parse', '--git-common-dir'), MARKER_FILE);
    return readFileSync(marker, 'utf8').trim() === git('rev-parse', 'HEAD');
  } catch {
    return false;
  }
}

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input.tool_input?.command ?? '';

if (GIT_PUSH.test(command) && !isHeadReviewed()) {
  process.stderr.write(`${BLOCKED_REASON}\n`);
  process.exit(2);
}
