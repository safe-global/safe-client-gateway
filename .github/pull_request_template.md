<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

## Summary

<!-- What changed and why. The reader is a reviewer who has not seen the ticket. Link the Linear issue (e.g. WA-1234). -->

## Changes

<!-- Per-area bullets, grouped by directory or module. -->

<!--
  Author checklist (docs/agents/reviewing.md — delete this comment before submitting):
  - [ ] Read the guides the routing table in AGENTS.md maps this diff to
  - [ ] One concern per PR; nothing unrelated refactored or reformatted
  - [ ] Env var? Declared in configuration.ts AND RootConfigurationSchema, added to
        .env.sample.json, mirrored in __tests__/configuration.ts, `yarn env:validate` clean
  - [ ] Migration? Every FK and WHERE-target column indexed in the same migration; `down` reverts
  - [ ] New/changed endpoint? Every input through `new ValidationPipe(Schema)`; DTO implements
        z.infer; guard on state-changing or caller-scoped routes
  - [ ] Cached read added or TTL raised? Invalidation lands in this PR, or the trade-off is
        stated in this description
  - [ ] SPDX license header on every file this PR touched, not only the new ones
  - [ ] No debug scripts, seed helpers, or transient logging left in the branch
  - [ ] Ratchet-baseline growth (if any) justified in this description
-->
