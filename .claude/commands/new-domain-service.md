---
description: Scaffold a domain service or repository (interface + Symbol token + implementation + module wiring + specs).
argument-hint: <module> <service description>
---

Scaffold a domain-layer service or repository in `safe-client-gateway`: $ARGUMENTS

Load these first and follow them rather than anything you remember:

- `cgw-module-structure` skill → `docs/agents/module-structure.md` (placement, naming table, Symbol-DI recipe)
- `cgw-nestjs-patterns` skill → `docs/agents/nestjs-patterns.md` (provider forms, DI gotchas, config access)
- `cgw-api-dtos` skill → `docs/agents/api-dtos-and-validation.md` (`Schema.parse()` at the boundary, error funnel)
- `cgw-testing` skill → `docs/agents/testing.md`

Then:

1. **Placement:** `src/modules/<module>/domain/`. `domain/` is mandatory in the canonical skeleton; `src/domain/` is a frozen tree and takes nothing new.
2. **Decide which it is.** A *repository* owns a datasource and is the layer that calls `Schema.parse()` on its `Raw<T>` output. A *domain service* holds a rule or a computation and depends on repositories. If it wraps an upstream API, it is a repository plus a datasource — use `/new-datasource` for the client half.
3. **Interface and Symbol token in one file** (`*.repository.interface.ts` / `*.service.interface.ts`): `export const IFoo = Symbol('IFoo')` alongside `export interface IFoo`. Wire it in the module as `{ provide: IFoo, useClass: Foo }` and add `IFoo` to `exports` if other modules need it.
4. **Injected dependencies are typed as the interface, not the class**, and declared `private readonly`. Read config in the constructor via `this.configurationService.getOrThrow<T>(...)` and cache it on a field — never `process.env`.
5. **Errors:** domain errors plus filters, or `HttpExceptionNoLog` for an expected rejection. A `catch` block always logs through `ILoggingService` or maps to the layer's error type — never both nothing.
6. **Keep the file to one thing.** Interfaces, shared types, constants, and helpers go in their own files beside it, not inline (this is the repo's most-repeated structural remark).
7. **Cross-module rule:** import other modules only through their `domain/`.
8. **Specs:** `*.spec.ts` with `MockedObject<T>` doubles for each injected interface, builders + faker for data, and exact-error assertions (`rejects.toThrow(new SomeError(...))`, never bare).
9. **If it touches the database directly,** an `*.integration.spec.ts` may be needed — and note that those hand-construct repositories, so adding a constructor parameter later means grepping `new <Repo>(` across all of them.
10. **SPDX header** on every new file.

Finish with `yarn format`, `yarn lint --fix`, `yarn test <paths>` and report the real output.
