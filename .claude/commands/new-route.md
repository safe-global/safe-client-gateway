---
description: Scaffold a new endpoint (controller handler + Zod schema + DTO + route service + specs) in the right module.
argument-hint: <module> <route description>
---

Scaffold a new endpoint in `safe-client-gateway`: $ARGUMENTS

Load these first and follow them rather than anything you remember:

- `cgw-api-dtos` skill → `docs/agents/api-dtos-and-validation.md` (validation, DTO pairing, versioning, Swagger)
- `cgw-module-structure` skill → `docs/agents/module-structure.md` (where the files go, naming, controller versioning)
- `cgw-security` skill → `docs/agents/security.md` **if** the route is state-changing or caller-scoped
- `cgw-testing` skill → `docs/agents/testing.md` (builders, mocks, the Fastify test harness)

Then:

1. **Locate the module.** If the named module exists under `src/modules/<kebab>/`, work there. If it does not, stop and confirm — a new module is `/new-module` territory and has its own checklist. Never add the route to `src/routes/` (frozen tree).
2. **Read the module's existing controller and route service** and match their shape: how they version, how they name DTOs, how they inject the repository. The nearest sibling is the spec, not this prompt.
3. **Write, in this order:** the Zod schema → the DTO class declared `implements z.infer<typeof Schema>` with `@ApiProperty`/`@ApiPropertyOptional` → the route-service method → the controller handler.
4. **Every `@Param`/`@Query`/`@Body` goes through `new ValidationPipe(<Schema>)`.** No bare parameter access.
5. **Repository, never datasource.** The route service calls the repository; only the repository calls `Schema.parse()` on a `Raw<T>`.
6. **Guard it** if it changes state or is scoped to the caller. Identity comes from `@Auth()` (verified JWT) or SIWE signature recovery — never from a body or query field.
7. **Specs:** a `*.spec.ts` for the route service, plus controller coverage. Data from builders + faker, `MockedObject<T>` for doubles (single cast, not `as unknown as`), `initTestApplication(app)` for any app-level test.
8. **SPDX header** on every new file: `// SPDX-License-Identifier: FSL-1.1-MIT`.

Finish by running `yarn format`, `yarn lint --fix`, and `yarn test <the paths you touched>`, and report the actual output.

If the route persists a new field, the four-representations checklist in `api-dtos-and-validation.md` applies — the domain schema, the `.entity.db.ts` plus migration, the DTO, and the builder all change together.
