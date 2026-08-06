---
name: cgw-commits-and-prs
description: Use when writing a commit message, a PR title, or a PR body in safe-client-gateway, or when deciding whether a change is too large for one PR. Covers the Conventional Commits shape this repo uses, the nine allowed types and when each applies, module-name scopes, the fact that main is squash-merged so the PR title becomes the permanent commit subject, the required PR body sections (Summary, Changes, Tests, Risk), how to split an oversized change, and issue linking. Triggers on "commit message", "commit this", "PR title", "PR description", "open a PR", "split this PR", "is this too big".
---

# CGW Commits and Pull Requests

Read **[docs/agents/commits-and-prs.md](../../../docs/agents/commits-and-prs.md)** before writing the message. This skill is a loader; the doc is the content.

The load-bearing fact: **`main` is squash-merged**, so the *PR title* becomes the commit subject on `main` with `(#NNNN)` appended by GitHub. Branch commit subjects are working notes; the PR title is permanent history.

Shape: `<type>(<scope>)?: <description>` — lowercase type from the doc's nine, optional scope that is a real `src/modules/` directory name in kebab-case, imperative lowercase description, under 72 chars, no trailing period.

**Nothing here is machine-enforced.** There is no `commit-msg` hook and no PR-title CI job — `.husky/pre-commit` only runs `env:validate:silent`, `lint`, and `format`. Every malformed subject on `main` today got there through that gap, so the check is yours.

PR body: `## Summary` and `## Changes` always; `## Tests` whenever `src/` changes; `## Risk` whenever behavior, a migration, an env var, or a cache key changes. `docs/agents/reviewing.md` requires ratchet-baseline justification and pre-commit evidence to appear in the PR description *text*, so those two sections are load-bearing, not decorative.

Before committing, run the pre-commit checklist from [AGENTS.md](../../../AGENTS.md): `yarn format`, `yarn lint --fix`, `yarn test`.
