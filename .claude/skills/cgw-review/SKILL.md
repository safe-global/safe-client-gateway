---
name: cgw-review
description: THE entry point for reviewing a diff or PR in safe-client-gateway, and for verifying your own completed work before committing or opening a PR - load this one first and let it pull in cgw-remarks as its catalog. Covers the repo's two-part review standard - Part 1 maps the diff to the applicable guides via the AGENTS.md routing table and verifies every rule with file:line citations; Part 2 is deviation control (spec match, no scope creep, no new structural deviations, no unjustified ratchet growth, no stale guides, no dead code, pre-commit evidence not assertion, SPDX headers) - plus the required findings format. Triggers on "review this", "look at my diff", "ready to commit", "before PR", "before I open the PR", "definition of done", "is this done", "check my work", "self-review".
---

# CGW Review Checklist

Read **[docs/agents/reviewing.md](../../../docs/agents/reviewing.md)** and apply both parts. This skill is a loader; the doc is the content.

*When* a review happens is your process's decision (Superpowers, spec-kit, CI). *What to verify in this repo* is that doc.

- **Part 1 — guideline compliance.** Map the diff against **every** row of the [AGENTS.md](../../../AGENTS.md) routing table, not just the first match; name the applicable guides in the output; verify every rule each one lists; cite violations as `file:line` plus the guide's own heading for that rule. "No guide applies" is a valid, statable outcome — a stretched match produces noise.
- **Part 2 — deviation control.** Eight independent checks; passing one never excuses failing another. The two that fail most often: pre-commit evidence (`yarn format`, `yarn lint --fix`, `yarn test` output or a CI link — an unproven "tests pass" is a finding), and SPDX headers on every file the change touched, not just created.

Findings are most-severe-first, one line each: `file:line — <rule name>: <one-sentence defect>`. A clean review states "no findings" explicitly.

Load **cgw-remarks** alongside this one — it is the catalog of what this repo's reviewers actually flag, indexed by the shape it takes in a diff.
