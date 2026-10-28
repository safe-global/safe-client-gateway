// SPDX-License-Identifier: FSL-1.1-MIT

// PreToolUse hook: blocks a `git push` until HEAD has passed the pre-PR
// architecture review. See docs/agents/agent-tooling.md "The pre-push gate".

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Heredoc bodies and quoted strings hold text, not commands (a commit message
// that mentions a push), so they are removed before matching.
const HEREDOC_BODY = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?^\s*\2\s*$/gm;
const QUOTED_STRING = /'[^']*'|"(?:\\.|[^"\\])*"/g;
const LINE_CONTINUATION = /\\\n/g;

// `git push` anywhere in what is left, with optional global options
// (`git -C dir push`), behind any prefix (`time`, `env`, `!`, `then`, `{`).
// `git stash push` and `git log --grep push` do not match.
const GIT_PUSH =
  /(?<![\w.-])git(?:\s+-{1,2}\S+(?:\s+[^\s-]\S*)?)*\s+push(?![\w-])/;
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
const command = (input.tool_input?.command ?? '')
  .replace(HEREDOC_BODY, '<<')
  .replace(LINE_CONTINUATION, ' ')
  .replace(QUOTED_STRING, "''");

if (GIT_PUSH.test(command) && !isHeadReviewed()) {
  process.stderr.write(`${BLOCKED_REASON}\n`);
  process.exit(2);
}
