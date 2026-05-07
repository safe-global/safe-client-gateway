<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Scope & PR Hygiene Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## CHANGE-02 — Do not bundle unrelated test or tooling fixes into a feature PR

Source: PR #2845 (RL-20251211-001)

### Avoid

Slipping an unrelated test infrastructure fix (faker seed reset,
race-condition shim, lint sweep) into a feature branch:

```ts
// PR title: feat: add Linea network support
// inside an unrelated controller spec:
beforeEach(async () => {
  // Reset faker seed to ensure consistent values when running all tests
  faker.seed(123);
  // ...rest of the original setup
});
```

### Prefer

Branch the cleanup into its own PR so the review reads only one
concern at a time:

```bash
git switch main
git switch -c chore/reset-faker-seed-in-imitation-spec
# move the seed-reset commit here
gh pr create --title "test: reset faker seed in imitation spec to fix flake"
# the original feature PR rebases without the test-only commit
```

### Why

A reviewer scanning a Linea support PR is not primed to spot subtle
test seed regressions, and a future bisect points at the feature
commit when the regression is actually in the bundled cleanup. Even
a one-line drive-by costs more in review attention than a follow-up
PR costs in process — especially when the cleanup itself deserves a
focused review of why the test was flaky to begin with.
