---
description: Audit an existing test file against this repo's testing guide and the recurring test remarks.
argument-hint: <path to a spec file or directory>
---

Audit the test file(s) at `$ARGUMENTS` against this repo's conventions.

Load the `cgw-testing` skill → `docs/agents/testing.md` and the `cgw-remarks` skill → `docs/agents/remarks.md` first. Check against what those say, not against general testing advice.

Read the file, then report findings as `file:line — <rule or remark id>: <one-sentence defect>`, most severe first. State "no findings" explicitly if it is clean.

Check for, at minimum:

**Harness**
- Bare `await app.init()` without `initTestApplication(app)` — this races Fastify's boot and hangs the test until timeout. Highest severity: it is a broken test, not a style issue.
- Test app built through something other than `new TestAppProvider().provide(moduleFixture)`.

**Data**
- Literal fixtures where a builder or faker belongs (R-004). Enum members, taxonomy strings, and assertion-boundary values are legitimate literals — do not flag those.
- A builder cloned inline instead of imported or extended.

**Doubles**
- `as unknown as MockedObject<T>` where a single cast compiles (R-001).
- `as never` to satisfy a mock signature (R-002).
- A hand-rolled `{ getOrThrow: vi.fn() }` double instead of `FakeConfigurationService` (R-003).
- A double typed as the concrete class rather than the injected interface.

**Assertions**
- Indexing into `.mock.calls` instead of `toHaveBeenCalledWith` / `toHaveBeenNthCalledWith` (R-005).
- Bare `rejects.toThrow()` with no expected error (R-006).
- Assertions that restate the source rather than constrain behavior (R-008).

**Hygiene**
- Comments paraphrasing the line below them (R-007).
- A test whose name does not describe what it asserts.
- Missing SPDX header.
- For an `*.integration.spec.ts`: a hand-constructed repository whose constructor arguments have drifted from the real one.

Do not rewrite the file unless asked. Report first; if the user then wants the fixes applied, apply only the ones reported and re-run `yarn test <path>` with real output.
