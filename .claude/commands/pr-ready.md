---
description: Run the author pre-PR checklist against the current diff — guides, deviation control, pre-commit commands, PR title and body.
---

Run the author pre-PR check against the current diff. $ARGUMENTS

Load the `cgw-review` skill → `docs/agents/reviewing.md`, the `cgw-remarks` skill → `docs/agents/remarks.md`, and the `cgw-commits-and-prs` skill → `docs/agents/commits-and-prs.md`.

**Step 1 — establish the diff.** `git diff --stat main...HEAD` plus `git status --short`. "The diff" is every file changed for this task, not just the last commit. List them.

**Step 2 — Part 1, guideline compliance.** Map the diff against **every** row of the routing table in `AGENTS.md`, not only the first match. Name the applicable guides. Then verify each rule they list against the diff, citing violations as `file:line` plus the guide's own heading for that rule. "No guide applies" is a valid outcome for a docs-only change — do not force-fit.

**Step 3 — Part 2, deviation control.** Eight independent checks; passing one never excuses failing another:

- Implementation matches the approved spec/plan (or the task description) — nothing extra, nothing missing. An unrequested improvement counts as extra.
- No scope creep: no unrelated refactors, drive-by renames, or opportunistic reformatting.
- No new deviations from the canonical module structure.
- No ratchet-baseline growth without a written justification **in the PR description text**.
- No speculative abstractions, unused exports, or dead code.
- Pre-commit commands ran clean — evidence, not assertion.
- Correct SPDX header on every file the change **touched**, not just created.
- No debug scripts, seed helpers, or transient logging left in the branch (R-027).

**Step 4 — scan `remarks.md`** for the sections matching what the diff touches, and report any `R-NNN` the diff would earn.

**Step 5 — run the pre-commit checklist and paste the real output:**

```bash
yarn format
yarn lint --fix
yarn test
```

If any of them fails, stop and report the failure — do not summarize it as passing.

**Step 6 — draft the PR title and body.** Title is a valid commit subject (`<type>(<scope>)?: <description>`, imperative, lowercase, under 72 chars) because `main` is squash-merged and the title becomes the permanent commit subject. Body carries `## Summary` and `## Changes` always, `## Tests` whenever `src/` changed (with the step-5 output or a CI link), and `## Risk` whenever behavior, a migration, an env var, or a cache key changed.

**Step 7 — verdict.** Report findings most-severe-first as `file:line — <rule name>: <defect>`, then state plainly whether this is ready to open. If the diff carries more than one concern, say so and propose the split (R-029) rather than approving it.
