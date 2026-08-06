<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Review Checklist

Repo-specific checklist for anyone reviewing a task, diff, or PR — per-task review checkpoints in agent workflows, the CI review agent, and humans. *When* reviews happen is governed by your process (e.g. Superpowers, spec-kit); *what to verify in this repo* is defined here.

## Part 1 — Guideline compliance

"The diff" means every file changed for the task under review, not only the latest commit within it.

- The review maps the diff to the applicable guides using the routing table in `AGENTS.md` and lists which guides apply.
  - A diff can match zero, one, or several routing-table rows — check the diff's files against every row, not only the first match.
  - List the applicable guides by name in the review output, even when the list has exactly one entry.
- Every rule of each applicable guide is verified against the diff; violations are reported as `file:line` plus the rule name.
  - "Every rule" means every rule the guide lists, not only the ones that look relevant at a glance.
  - The rule name is the guide's own heading for that rule (e.g. "Pipe every input"), not a paraphrase — this keeps a finding traceable back to its source rule.
  - A rule counts as not applicable only when the diff does not touch what the rule governs (e.g. a migration rule against a diff with no migration files) — that is a different outcome from the rule being satisfied, and both are reportable as such.
- When no guide applies to a change, the review states so explicitly — that is a valid outcome.
  - Example: a change confined to comments or non-code `.md` files with no routing-table match needs no further action in this part.
  - Do not force-fit a change into a guide it does not match; a stretched match produces noise, not signal.

## Part 2 — Deviation control

These checks are independent of Part 1 and of each other: passing one never excuses failing another.

- [ ] Implementation matches the approved spec/plan where one exists — nothing extra, nothing missing.
  - Absent an approved spec/plan, judge against the task description the work was given.
  - An improvement not asked for in the spec/plan is still "extra" for this item — flag it, do not wave it through as a bonus.
- [ ] No scope creep: no unrelated refactors, drive-by renames, or opportunistic cleanups outside the task.
  - A file touched but not named in the task's scope is scope creep unless it is a direct, necessary consequence of an in-scope change.
  - "Opportunistic cleanup" includes reformatting or reordering code the task did not ask to change.
- [ ] No new deviations from the canonical module structure (`docs/agents/module-structure.md`).
  - Check new or moved files against the canonical skeleton in that guide; a module that is off-shape is a finding even when it passes its own tests.
  - This covers files moved or renamed during the task, not only newly created ones.
- [ ] No ratchet-baseline growth without written justification in the PR description.
  - A baseline file growing without an explanation in the PR description is a finding regardless of whether the underlying check still passes.
  - This applies to any accepted-exceptions list (lint suppressions, dependency-boundary allowlists, and similar), not only to a single named file.
  - A justification recorded only in a commit message or a chat thread does not satisfy this item; it must appear in the PR description text itself.
  - At a per-task checkpoint before any PR exists, this item is not-yet-checkable rather than failed — it is evaluated at PR time.
- [ ] No speculative abstractions, unused exports, or dead code introduced (YAGNI).
  - An interface with a single implementation that isn't a standard Symbol-DI seam (this repo's one-interface/one-implementation-per-datasource pattern), an export nothing imports, and a config flag with no reader are each their own finding.
  - A helper generalized (parameterized, exported, or made reusable) beyond what its one call site actually needs, or an abstraction built for an anticipated future need, is a finding on the same basis as literal dead code.
- [ ] Pre-commit checklist commands (`yarn format`, `yarn lint --fix`, `yarn test`) ran clean — evidence, not assertion.
  - A stated "tests pass" without pasted command output or a CI run link does not satisfy this item.
  - Running only some of the three commands, or running them against an earlier version of the diff, does not satisfy this item either.
- [ ] New/changed files carry the correct SPDX license header.
  - Compare the header text against `LICENSE_HEADER.txt` and the comment style for that file type; presence of any header is not sufficient.
  - A missing header on a file the task modified — not just one it created — is still a finding.

## Reporting format

Findings are ordered most-severe-first. Each finding is one line:

```
file:line — <rule name>: <one-sentence defect>
```

`file:line` identifies the specific line the defect lives on; a file-level comment with no line number does not meet this format.

For a Part 2 finding, `<rule name>` is that item's lead phrase (e.g. `No scope creep`). When a finding has no single code line — missing evidence, missing PR-description justification — the report cites the artifact the defect lives in (the PR description, the command output) in place of a line number.

A review with no violations states "no findings" explicitly in place of a findings list; an empty or omitted section is not equivalent to that statement.

The same two parts apply whether the reviewer is a per-task checkpoint inside an agent workflow, the CI review agent, or a human — none of them is exempt from either part.
