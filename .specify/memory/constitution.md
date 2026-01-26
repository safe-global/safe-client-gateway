<!--
SYNC IMPACT REPORT
==================
Version change: N/A (initial) → 1.1.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (5 principles)
  - Development Workflow
  - Quality Standards
  - Governance
  - Core Principles VI: NestJS Architecture & Code Style (v1.1.0)
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check section exists)
  - .specify/templates/spec-template.md ✅ aligned (requirements/testing focus)
  - .specify/templates/tasks-template.md ✅ aligned (test-first, phased approach)
Follow-up TODOs: None
-->

# Safe Client Gateway Constitution

## Core Principles

### I. Pre-Commit Quality Gates (NON-NEGOTIABLE)

Every code change MUST pass the following checks in sequence before commit:

1. **Format**: `yarn format` - Prettier formatting applied
2. **Lint**: `yarn lint --fix` - ESLint rules enforced, remaining errors fixed manually
3. **Test**: `yarn test` - All unit tests pass

**Rationale**: These gates prevent broken code from entering the repository. Skipping any step is forbidden, even for "minor" changes. If any command fails, the issue MUST be resolved before committing.

### II. Testing Discipline

- Unit tests (`*.spec.ts`) MUST mock all external dependencies
- Integration tests (`*.integration.spec.ts`) MUST use real infrastructure
- New functionality MUST include corresponding tests
- Test files MUST be co-located with the code they test
- Tests MUST be independent and idempotent

**Rationale**: The test suite is the safety net. Unit tests run in ~2 minutes and validate business logic in isolation. Integration tests validate real infrastructure interactions.

### III. API Consistency

- All endpoints MUST be documented via OpenAPI/Swagger decorators
- REST conventions MUST be followed for resource naming and HTTP methods
- Response schemas MUST use Zod for runtime validation
- Breaking API changes MUST be versioned appropriately

**Rationale**: The Client Gateway serves as the bridge between Safe{Wallet} clients and backend services. Consistent API contracts ensure frontend teams can reliably integrate.

### IV. Database Integrity

- Schema changes MUST use TypeORM migrations (never manual DDL)
- Entity files MUST follow naming convention: `{name}.entity.db.ts`
- Entity files MUST reside in `src/**/entities/` directories
- Migrations MUST be tested before deployment

**Rationale**: Database schema consistency across environments is critical. The migration system ensures reproducible schema evolution.

### V. Simplicity & Focus

- PRs MUST focus on a single feature, bugfix, or improvement
- Unnecessary complexity, abstractions, or large-scale refactors MUST be justified
- Changes MUST align with project goals and roadmap
- YAGNI (You Aren't Gonna Need It) principle applies

**Rationale**: The codebase serves production Safe{Wallet} clients. Every change carries risk. Focused, minimal changes are easier to review, test, and revert if needed.

### VI. NestJS Architecture & Code Style

#### Layered Architecture

The codebase follows a three-layer architecture with unidirectional dependencies:

```
Routes (Controllers) → Domain (Repositories) → Datasources (APIs/Infrastructure)
```

- **Routes**: Controllers, API DTOs (Swagger), route services, mappers
- **Domain**: Business logic, domain entities (Zod), repository interfaces/implementations
- **Datasources**: External API clients, infrastructure (cache, database, network)

#### Modular Feature Structure

Features MUST be organized under `src/modules/{feature}/`:

```
{feature}/
├── {feature}.module.ts
├── routes/
│   ├── {feature}.controller.ts
│   ├── {feature}.service.ts
│   ├── {feature}.mapper.ts
│   └── entities/           # API DTOs (@ApiProperty)
├── domain/
│   ├── {feature}.repository.ts
│   ├── {feature}.repository.interface.ts
│   ├── entities/           # Domain types (z.infer<Schema>)
│   │   └── schemas/        # Zod schemas
│   ├── errors/
│   └── __tests__/          # Builders
└── datasources/            # External APIs (optional)
```

#### Symbol-Based Dependency Injection

Services MUST be injected via Symbols (DRY principle):

```typescript
// Interface exports Symbol + contract
export const IFeatureRepository = Symbol('IFeatureRepository');
export interface IFeatureRepository { ... }

// Module wires implementation
providers: [{ provide: IFeatureRepository, useClass: FeatureRepository }]

// Consumer injects via Symbol
constructor(@Inject(IFeatureRepository) private readonly repo: IFeatureRepository) {}
```

New dependencies MUST be injected as services, never imported directly.

#### File Naming

- `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.repository.interface.ts`
- `*.mapper.ts`, `*.module.ts`, `*.entity.ts`, `*.schema.ts`, `*.entity.db.ts`
- Tests: `*.spec.ts`, `*.integration.spec.ts`, `*.e2e-spec.ts`
- Builders: `__tests__/*.builder.ts`

#### Entity Separation

- **Domain entities**: `type X = z.infer<typeof XSchema>` (internal, validated)
- **API entities**: Classes with `@ApiProperty` decorators (external, Swagger)
- Mappers transform domain → API entities

#### Infrastructure Abstractions

- Configuration: `IConfigurationService` (never hardcode)
- Logging: `ILoggingService` (never NestJS `Logger`)
- Caching: `CacheService` + `CacheRouter`
- HTTP: `NetworkService`

#### Test Structure

- Constants at module level (above `describe`)
- Test data via `Builder<T>` pattern
- Builders in `domain/entities/__tests__/`

**Rationale**: Consistent architecture enables maintainability, testability, and onboarding. Symbol-based DI enforces loose coupling and makes mocking straightforward.

## Development Workflow

### Branch Naming

Use descriptive branch names following the pattern:

- Features: `feature/description`
- Bugfixes: `bugfix/description`
- Documentation: `docs/description`

### Commit Process

```bash
# 1. Make code changes
# 2. Run quality gates (MANDATORY)
yarn format
yarn lint --fix
yarn test

# 3. Only after ALL checks pass
git add <files>
git commit -m "type: description"
```

### Pull Request Requirements

- Clear title and detailed description
- Link related issues (e.g., `Fixes #123`)
- All CI checks passing
- Scope limited to single concern
- Documentation updated if behavior changes

## Quality Standards

### Code Style

- ESLint and Prettier configurations are authoritative
- No custom style overrides without team consensus
- Imports organized consistently (enforced by tooling)

### Test Coverage

- Unit tests: Business logic, services, controllers, validators
- Integration tests: Database repositories, migrations, message queues
- E2E tests: Critical user flows and API contracts

### Documentation

- README.md for project setup and running instructions
- OpenAPI for API documentation
- Code comments for non-obvious logic only

## Governance

### Constitution Authority

This constitution supersedes ad-hoc practices. All contributions MUST verify compliance with these principles.

### Amendment Process

1. Propose amendment via pull request to this file
2. Document rationale for change
3. Obtain team review and approval
4. Update version according to semantic versioning:
   - MAJOR: Principle removal or incompatible redefinition
   - MINOR: New principle or significant expansion
   - PATCH: Clarifications, wording improvements

### Compliance Review

- All PRs MUST be reviewed against these principles
- CI pipelines enforce automated quality gates
- Complexity additions MUST be explicitly justified

**Version**: 1.1.0 | **Ratified**: 2026-01-21 | **Last Amended**: 2026-01-26
