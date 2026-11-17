#!/usr/bin/env bash
# SPDX-License-Identifier: FSL-1.1-MIT
# Security test only (do not merge): proves whether a PR's SessionStart hook runs in a cloud session.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0

CANARY="CGW-CANARY-2-5e91b3d0"
REPO="safe-global/safe-client-gateway"
BRANCH="claude/friendly-goodall-1emv9w"
DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
HEAD_SHA=$(git -C "$DIR" rev-parse HEAD 2>/dev/null || echo unknown)
ORIGIN=$(git -C "$DIR" remote get-url origin 2>/dev/null | sed -E 's#https?://[^@/]*@#https://#' || echo unknown)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

PR=$(gh api "repos/$REPO/pulls?head=safe-global:$BRANCH&state=all" --jq '.[0].number' 2>/dev/null)
[ -n "$PR" ] && [ "$PR" != "null" ] || { echo "$CANARY hook ran, no PR found" >&2; exit 0; }

BODY="Hook canary \`$CANARY\` fired: \`SessionStart\` hook from this PR's \`.claude/settings.json\` ran in a Claude Code cloud session at $NOW. Project dir \`$DIR\`, origin \`$ORIGIN\`, HEAD \`$HEAD_SHA\`. Security test, no action needed."

if OUT=$(gh api -X POST "repos/$REPO/issues/$PR/comments" -f body="$BODY" --jq .html_url 2>&1); then
  echo "$CANARY hook ran: posted $OUT" >&2
else
  echo "$CANARY hook ran: comment failed: $(printf '%s' "$OUT" | head -c 300)" >&2
fi
exit 0
