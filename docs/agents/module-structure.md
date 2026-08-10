<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Module Structure

This guide governs where module code lives and what it may import.
The canonical shape below is mandatory for new modules and new files; existing deviations from it are not precedent to extend.

### Canonical skeleton

**Rule:** A new module is `src/modules/<kebab-name>/` containing a `<kebab-name>.module.ts` and a `domain/`; add `routes/` only when the module exposes HTTP endpoints, and `datasources/` only when the module owns an external API client.

```
src/modules/<kebab-name>/
├── <kebab-name>.module.ts
├── domain/
│   ├── <name>.repository.ts
│   ├── <name>.repository.interface.ts
│   └── entities/            # Zod schemas + z.infer types (+ __tests__/ builders)
├── routes/                  # only if HTTP endpoints exist
│   ├── <name>.controller.ts
│   ├── <name>.service.ts
│   ├── entities/            # DTOs (Zod schema + @ApiProperty class)
│   └── v2/                  # versioned controllers when needed
└── datasources/             # only if the module owns an external API
    ├── <api>-api.service.ts
    └── entities/*.entity.db.ts
```

`domain/entities/` and `routes/entities/` hold different things (internal Zod entities vs Swagger-documented DTOs) — see the Module anatomy section of `docs/agents/ARCHITECTURE.md` for the distinction.

**Why:** the majority of existing modules already follow this shape; deviations from it are the recurring source of review churn, since a reviewer has to relearn a bespoke layout for one module instead of checking it against a shape they already know.

**Canonical example:** `src/modules/spaces/`, `src/modules/chains/`.

**Anti-example:** `src/modules/portfolio/` (route services live under `domain/`, and it versions with a module-root `v1/` instead of `routes/v2/`); `src/modules/safe-shield/` (no `domain/` or `routes/` at all — a controller at the module root plus one sub-module per analysis kind, `contract-analysis/`, `threat-analysis/`, `recipient-analysis/`, each with its own `*.module.ts`/`*.service.ts`) — do not imitate either.

### Layer placement

**Rule:** Route services — the `*.service.ts` files a controller calls — live in `routes/`; repositories live in `domain/`. A route service calls a repository, never a datasource directly. A repository is the only place that parses a datasource's output with a Zod schema.

This mirrors the request-lifecycle chain in `docs/agents/ARCHITECTURE.md`: `Controller → Route Service → Repository → Datasource → CacheFirstDataSource → upstream API`.

**Why:** this is the documented layering contract every module is expected to follow. A service that reaches past its repository into a datasource bypasses the one place a datasource's raw response is required to be parsed with a Zod schema; `portfolio` violated the layering and is not a second precedent.

**Canonical example:** `src/modules/safe/`.

**Anti-example:** `src/modules/portfolio/domain/portfolio.service.ts` (a route-shaped service placed under `domain/`) — do not imitate.

### Symbol DI wiring

**Rule:** Declare `export const IFooRepository = Symbol('IFooRepository')` next to `export interface IFooRepository` in `<foo>.repository.interface.ts`. Bind it in the owning module as `{ provide: IFooRepository, useClass: FooRepository }`. Inject it as `@Inject(IFooRepository) private readonly fooRepository: IFooRepository` — the property is typed as the interface, never the concrete class.

**Why:** roughly a dozen sites have drifted into typing a Symbol-injected dependency as its concrete class, which quietly breaks substitutability even though the DI wiring still runs: once the property's declared type is the class rather than the interface, swapping the binding for a test double or an alternate implementation no longer type-checks.

**Canonical example:** `src/modules/tokens/domain/token.repository.interface.ts`; consumed correctly in `src/modules/balances/routes/balances.service.ts`, which injects `@Inject(IChainsRepository) private readonly chainsRepository: IChainsRepository`.

**Anti-example:** `src/modules/messages/routes/messages.service.ts` injects `@Inject(IMessagesRepository)` and `@Inject(ISafeRepository)` but types the resulting properties as the concrete `MessagesRepository`/`SafeRepository` classes — do not imitate.

### New Symbol+interface pairs need a reason

**Rule:** Introduce a new `Symbol`-backed interface only when a second implementation exists, or a `test.*.module.ts` swap needs one; otherwise inject the concrete class directly. A `test.*.module.ts` swap looks like `src/modules/users/__tests__/test.users.module.ts`, which rebinds `IUsersRepository`/`IMembersRepository` to a plain mock provider for other modules' integration tests. The standard repository Symbol-DI seam from the previous rule is always justified on its own and needs no further reason.

**Why:** pure ceremony already exists in the codebase — an interface with a single implementation and no module-level swap is one more file to open per change, with no substitutability behind it.

**Canonical example:** `IConfigurationService` (`src/config/configuration.service.interface.ts`) paired with `FakeConfigurationService`, a real second implementation used throughout specs — here the interface earns its keep.

**Anti-example:** `src/domain/interfaces/fee-service-api.interface.ts` has exactly one implementation, and its consumers' tests mock it by casting a plain object (`as MockedObject<IFeeServiceApi>`) rather than swapping in a second class — the interface buys nothing there — do not imitate.

### Cross-module imports via domain only

**Rule:** A module imports another module only through that module's `domain/` — its interfaces and entities. It never imports another module's `routes/*` or `datasources/*`.

This applies in both directions: neither a module's `routes/` nor its `datasources/` is a valid import target for anything outside that module.

**Why:** importing another module's `routes/*` drags HTTP-layer concerns (controllers, DTOs, guards) into code that has no business depending on them, and it means a change to another module's controller or DTO shape can break a module that has nothing to do with HTTP.

**Canonical example:** `src/modules/balances/routes/balances.service.ts` imports `IChainsRepository` from `@/modules/chains/domain/chains.repository.interface` — the `chains` module is reached only through its `domain/`.

**Anti-example:** `src/modules/billing/routes/billing.controller.ts` imports `@/modules/spaces/routes/pipes/space-id.pipe` and `@/modules/auth/routes/decorators/auth.decorator`; `src/modules/notifications/domain/v2/entities/notification.entity.ts` imports from `@/modules/hooks/routes/entities/event-type.entity`. Neither is precedent — do not imitate.

### Frozen legacy trees

**Rule:** Do not add new files under `src/routes/`, except to the shared infrastructure in `src/routes/common/`. Do not add new feature entities to `src/domain/`. Do not add new API-client directories under central `src/datasources/` — a new client is a module-local `datasources/`. Central `src/datasources/` holds only cross-cutting infra (cache, db, network, jwt, kms, job-queue, storage, circuit-breaker) plus six legacy API clients that may still be imported but never joined by a new sibling: `billing-api`, `config-api`, `etherscan-api`, `fee-service-api`, `locking-api`, `push-notifications-api`.

**Why:** these three trees predate the per-module layout; letting new feature code land in them recreates the pre-module tangle the current layout exists to escape. A fix to a bug that already lives in one of these trees still lands there — "frozen" describes where new code goes, not a ban on touching the tree at all. See `docs/agents/ARCHITECTURE.md` (Legacy trees section) for the full rationale.

**Canonical example:** the six legacy clients named in the Rule above — importable, frozen, never extended with a new sibling directory.

**Anti-example:** a new `src/datasources/<new-api>/` sibling directory beside them, or a new feature file under `src/routes/<feature>/` or `src/domain/` — that code belongs in the owning module — do not imitate.

### File naming

**Rule:** Use kebab-case plus a role suffix: `.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.repository.interface.ts`, `.entity.ts` (domain), `.entity.db.ts` (TypeORM, only under `datasources/entities/`), `.builder.ts` (test builders), `.dto.entity.ts` (route DTOs). Name a repository's NestJS module `<name>-repository.module.ts`.

**Why:** several competing repository-module namings exist in the codebase — hyphenated, dotted, and a `test.`-prefixed variant among them; this freezes one going forward instead of letting another appear.

**Canonical example:** `src/modules/users/datasources/entities/users.entity.db.ts` (`.entity.db.ts`), `src/modules/spaces/routes/entities/create-space.dto.entity.ts` (`.dto.entity.ts`), `src/modules/users/domain/users-repository.module.ts` (`<name>-repository.module.ts`).

**Anti-example:** `src/modules/notifications/domain/v2/notifications.repository.module.ts` (dotted `<name>.repository.module.ts`, one of the competing forms) — do not imitate going forward.

### Versioning

**Rule:** A versioned controller lives in a version directory and carries the version in the filename before `controller`: `routes/vN/<name>.vN.controller.ts`, decorated with `@Controller({ version: 'N' })`. Never put the version suffix after `controller` (`*.controller.vN.ts`), never put a version directory at the module root (`<module>/v1/`), never use a versioned filename outside a version directory, and never an unversioned filename inside a version directory (`routes/vN/<name>.controller.ts`).

**Why:** several versioning styles exist across the codebase; this is the form to converge on. It keeps `.controller.ts` as the terminal suffix, so anything matching controllers by that suffix still finds the versioned ones — the `*.controller.vN.ts` style escapes such matching, and a module-root version directory is indistinguishable at a glance from an unrelated top-level concern.

**Canonical example:** `src/modules/chains/routes/v2/chains.v2.controller.ts` and `src/modules/safe/routes/v2/safes.v2.controller.ts`, each decorated with `version: '2'`.

**Anti-example:** `src/modules/owners/routes/owners.controller.v1.ts` (version suffix after `controller` — also has `.v2.ts`/`.v3.ts` siblings); `src/modules/csv-export/v1/` (module-root version directory); `src/modules/notifications/routes/v1/notifications.controller.ts` (unversioned filename inside a version directory) — do not imitate.

### Imports

**Rule:** Always import via the `@/` path alias; never use a relative parent (`../`) import.

**Why:** an alias import survives a file being moved to a different directory; a relative parent import breaks the moment either endpoint moves, which is what keeps refactors cheap and keeps a file movable without a cascade of path edits.

**Canonical example:** the `@/*` → `./src/*` mapping in `tsconfig.json` is what every module's imports resolve through.

**Anti-example:** `src/modules/safe-shield/entities/__tests__/builders/analysis-requests.builder.ts` imports its entity via `../../analysis-requests.entity` — one of only a handful of violations — do not imitate.

### New-module checklist

This list is descriptive, not sequential — it states what a complete module has, not an order of steps to perform.

A new module has:

- A `<kebab-name>.module.ts` plus the `domain/` skeleton, with `routes/`/`datasources/` present only where the module actually needs them.
- A `Symbol`+interface pair for each repository, co-declared per the Symbol DI wiring rule.
- An entry registering the module in `src/app.module.ts`.
- Test builders under `domain/entities/__tests__/` for its domain entities.
- Specs co-located with the code they exercise.
- Its endpoints, datasources, and migrations named in the routing table in `AGENTS.md`, so the guides that govern them are discoverable.
