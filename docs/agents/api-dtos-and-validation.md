<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# API DTOs and Validation

This guide sets the conventions for HTTP inputs and outputs in CGW: validating a request argument, pairing a domain shape with a Swagger-documented DTO, versioning a route, and funneling a thrown error to the right response. `ValidationPipe` at the inbound boundary and `Raw<T>`/`Schema.parse()` at the outbound one are described in `docs/agents/ARCHITECTURE.md`'s Validation model section; this guide states the normative rules for writing a route, a DTO, or an error path against that model.

### ValidationPipe everywhere

**Rule:** Validate every `@Param`, `@Query`, and `@Body` controller argument in place with `new ValidationPipe(SomeZodSchema)`; `class-validator` is never used (it is not a dependency of this repo). A generic primitive — address, hex, UUID, numeric string — pipes with the matching shared schema from `src/validation/entities/schemas/`; a new chain-id-shaped value uses `ChainIdSchema` (`src/modules/chains/domain/entities/schemas/chain-id.schema.ts`), which lives in the chains module rather than the shared folder because it layers a chain-id-specific length bound on top of the shared `NumericStringSchema`. Existing route params piped with bare `NumericStringSchema` predate `ChainIdSchema` and are not retroactive violations — they are also not precedent to extend.

**Why:** `docs/agents/security.md`'s "Pipe every input" rule states why every argument must be piped at all — an unvalidated value reaches a datasource's upstream URL untouched otherwise. This rule assumes that requirement and states only which schema a given shape reaches for.

**Canonical example:** `src/modules/contracts/routes/contracts.controller.ts`'s `getContract` pipes both route params in place — `@Param('chainId', new ValidationPipe(NumericStringSchema))` (a pre-`ChainIdSchema` pipe, showing the mechanics) and `@Param('contractAddress', new ValidationPipe(AddressSchema))`. `ChainIdSchema`'s own refinement is exercised as a field in `src/modules/counterfactual-safes/routes/entities/counterfactual-safe.dto.entity.ts`'s `CounterfactualSafeSchema` (`chainId: ChainIdSchema`), rather than that DTO reaching for the bare `NumericStringSchema`.

The shared folder's full primitive catalog — `AddressSchema`, `HexSchema`, `UuidSchema`, `RedirectUrlSchema`, and `NumericStringSchema` itself — is inventoried in `docs/agents/ARCHITECTURE.md`'s Validation model section; a new generic primitive is added there, not next to whichever module happens to need it first.

### DTO pairing

**Rule:** A route DTO lives in `routes/entities/*.dto.entity.ts` as a Zod schema plus a class `implements z.infer<typeof Schema>`, one `@ApiProperty` per field. The schema is what `ValidationPipe` runs against at request time; the class exists only so Swagger has a shape to document.

**Why:** Nest's Swagger plugin reads decorators off a class, not a Zod schema's internal shape, so the two are necessarily two declarations of the same fields; the `implements` clause is what keeps a field added to one from being silently missing from the other.

**Canonical example:** `src/modules/spaces/routes/entities/create-space.dto.entity.ts` declares `CreateSpaceSchema` alongside `class CreateSpaceDto implements z.infer<typeof CreateSpaceSchema>`:

```ts
export const CreateSpaceSchema = z.object({ name: SpaceSchema.shape.name });

export class CreateSpaceDto implements z.infer<typeof CreateSpaceSchema> {
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];
}
```

`src/modules/spaces/routes/spaces.controller.ts` wires both halves into the same endpoint — `@ApiBody({ type: CreateSpaceDto })` for Swagger, `@Body(new ValidationPipe(CreateSpaceSchema)) body: CreateSpaceDto` for runtime validation — so the class and the schema back the exact same request.

The same file's `CreateSpaceResponse`, by contrast, carries only `@ApiProperty` fields with no paired schema and no `implements` clause: nothing parses a response body, so a response-only DTO needs just the Swagger half of the pairing.

### Domain types from Zod

**Rule:** A domain shape is declared once, as `XSchema` plus `export type X = z.infer<typeof XSchema>`, under a module's `domain/entities/`; a hand-written `interface` standing in for a data shape is never added. This governs data shapes specifically — a repository/datasource contract (`IFooRepository`) is a Symbol-DI seam, not a data shape, and is governed instead by `docs/agents/module-structure.md`'s Symbol DI wiring rule.

**Why:** a schema hand-fitted to a pre-existing interface, or a second interface maintained beside a schema, drifts the moment either is edited alone; deriving the type from the schema with `z.infer` leaves exactly one declaration to keep current.

**Canonical example:** `src/modules/users/domain/entities/user.entity.ts` declares `export type User = z.infer<typeof UserSchema>` ahead of `UserSchema`, then gives `UserSchema` an explicit `z.ZodType<...>` annotation — required because `User` and `Member` recurse into each other through `z.lazy`:

```ts
export type User = z.infer<typeof UserSchema>;

// We need explicitly define ZodType due to recursion
export const UserSchema: z.ZodType<
  z.infer<typeof RowSchema> & { /* status, email, wallets, members */ }
> = RowSchema.extend({ /* ... */ });
```

Declaring the type ahead of the schema is the ordinary shape throughout `domain/entities/` either way — `src/modules/balances/domain/entities/balance.entity.ts`'s `Balance`/`NativeBalance`/`Erc20Balance` do the same with a plain, non-recursive `z.object(...)` and no extra annotation. Only the explicit `z.ZodType<...>` is recursion-specific.

The same inferred type is what a persisted entity's `implements DomainX` clause checks against at compile time; see `docs/agents/database-and-migrations.md`'s Entity placement and compile-time sync rule for that half of the mechanism.

### `Raw<T>` at the boundary

**Rule:** A datasource method that returns upstream data types its return as `Raw<T>` (`src/validation/entities/raw.entity.ts`), produced by calling `rawify()`; the owning repository calls `Schema.parse()` on that value before returning it as a trusted domain entity. A datasource method returning a bare, non-`Raw` upstream type is a violation.

**Why:** `Raw<T>` is a phantom type (`type Raw<_> = symbol`) that makes the compiler reject an unparsed value everywhere a real `T` is expected, so "a repository parses before trusting" is a compile-time guarantee rather than a convention reviewers must remember to check. The mechanism itself is described in `docs/agents/ARCHITECTURE.md`'s Validation model section; this rule is its normative form for a new datasource method.

**Canonical example:** `src/modules/balances/datasources/safe-balances-api.service.ts`'s `getBalances` returns `Promise<Raw<Array<Balance>>>`; `src/modules/balances/domain/balances.repository.ts`'s `getBalances` calls it and returns `BalancesSchema.parse(balances)` — the plain `Array<Balance>` a route service can actually consume.

`Raw<T>` itself (`src/validation/entities/raw.entity.ts`) is a two-line mechanism, not a wrapper object:

```ts
export type Raw<_> = symbol;

export function rawify<T>(value: T): Raw<T> {
  return value as Raw<T>;
}
```

At runtime, `rawify(value)` returns `value` completely unchanged; only the compile-time type changes, which is what makes the cast free and the boundary purely a type-checker construct.

This is also why the parse call belongs to the repository and nowhere else: `docs/agents/module-structure.md`'s Layer placement rule states that a repository is the only layer allowed to parse a datasource's output, so this rule has one enforcement point per module rather than one per call site.

### The 4-representations checklist

**Rule:** A complete change to a persisted shape touches: the domain Zod schema, the `*.entity.db.ts` class (plus its migration), the route DTO class(es) that expose the field, and the test builder that constructs it. No generator keeps these four in sync; the compiler catches drift between the first two — the schema and the entity's `implements` clause — but never between either of them and a Swagger class or a builder.

**Why:** a field that reaches the database and the domain schema but never lands in the DTO class or the builder ships silently: nothing fails to compile, it simply never reaches a client's Swagger docs, or a spec keeps constructing the shape without it.

**Canonical example:** the `spaces` module's `uuid` field exists in all four places today: `SpaceSchema` (`src/modules/spaces/domain/entities/space.entity.ts`), the `Space` entity class (`src/modules/spaces/datasources/spaces/entities/space.entity.db.ts`) added by `migrations/1779200000001-add-space-uuid.ts`, `CreateSpaceResponse`'s `@ApiProperty() uuid` (`create-space.dto.entity.ts`), and `spaceBuilder()`'s `.with('uuid', fakeUuid())` (`src/modules/spaces/domain/entities/__tests__/space.entity.db.builder.ts`). See `docs/agents/database-and-migrations.md` for the entity-placement and migration half of this checklist in depth.

A join/junction table is the one place today's code varies from this shape — see `docs/agents/database-and-migrations.md`'s Entity placement rule — but a new one still gets all four representations; the checklist does not shrink for a table that happens to sit between two others.

### Swagger completeness

**Rule:** Every controller endpoint carries `@ApiOperation` plus a response decorator for each outcome it can actually produce (`@ApiOkResponse`, `@ApiBadRequestResponse`, and so on); a paginated response exposes a concrete `class XPage extends Page<X>` rather than a route declaring `Page<X>` directly.

**Why:** SwaggerModule builds its docs from decorators on the controller, not from the handler's TypeScript return type, and it cannot generate a model definition from a bare generic — `Page<T>` needs a per-item subclass at every call site or the paginated field never gets a documented shape.

**Canonical example:** `src/modules/relay/routes/relay.controller.ts`'s `relay` method carries `@ApiOperation`, `@ApiBody`, `@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiForbiddenResponse`, `@ApiUnprocessableEntityResponse`, and `@ApiTooManyRequestsResponse` — one decorator per response this endpoint can produce. `src/modules/chains/routes/entities/chain-page.entity.ts`'s `class ChainPage extends Page<Chain>` is the concrete-subclass half, declaring `@ApiProperty({ type: Chain, isArray: true }) results!: Array<Chain>`; `src/routes/common/entities/page.entity.ts` documents why in its own comment, that "the SwaggerModule cannot generate model definitions based on Generics."

The pagination envelope and cursor-parsing conventions behind a paginated response — `buildPageSchema`, `PaginationData` — are covered in `docs/agents/database-and-migrations.md`'s Pagination rule; this rule covers only the Swagger-completeness angle, which applies equally to a paginated and a non-paginated endpoint.

### URI versioning

**Rule:** A controller declares its path and version together, `@Controller({ path, version })`; a breaking response-shape change adds a new version alongside the existing one rather than changing the existing one in place.

**Why:** Nest's `VersioningType.URI` (configured once in `src/app.provider.ts`) maps a controller's `version` straight onto a `/v1/...`/`/v2/...` path segment, so a client still on the old version keeps working unaffected the moment a new version is added beside it.

**Canonical example:** `src/modules/chains/routes/chains.controller.ts` declares `@Controller({ path: 'chains', version: '1' })`; `src/modules/chains/routes/v2/chains.v2.controller.ts` declares the same `path: 'chains'` with `version: '2'`, alongside it rather than in place of it. See `docs/agents/module-structure.md`'s Versioning rule for where the new controller's file and directory go.

A non-breaking addition — a new optional field, a brand-new endpoint — lands on the existing version in place; only a change that would break an already-shipped client's parsing of the response, such as a removed or renamed field, earns a new version rather than an in-place edit.

### One error funnel per layer

**Rule:** A datasource throws only a `DataSourceError`, produced by `HttpErrorFactory.from(error)` from within a `catch`; an expected, client-caused verification failure throws `HttpExceptionNoLog`; nothing in feature code constructs a raw `new HttpException(...)` directly; a new domain-specific failure mode gets its own domain error class plus a matching exception filter rather than being forced into an unrelated exception type.

**Why:** `DataSourceErrorFilter`, `ZodErrorFilter`, and `GlobalErrorFilter` (`docs/agents/ARCHITECTURE.md`'s Error handling section) are each keyed to one exception shape; an error thrown outside its intended shape either loses the safe-to-expose message split `DataSourceError` carries, or gets logged as an unexpected 5xx when `HttpExceptionNoLog` would have marked it as expected, non-incident noise.

**Canonical example:** `src/modules/balances/datasources/safe-balances-api.service.ts`'s `getBalances` and `getCollectibles` each wrap their fetch in `catch (error) { throw this.httpErrorFactory.from(error); }`. `src/modules/messages/domain/helpers/message-verifier.helper.ts`'s `MessageVerifierHelper` throws `HttpExceptionNoLog` for a Safe message whose computed hash doesn't match the client-asserted one. The domain-error-plus-filter half: `src/modules/relay/domain/errors/relay-denied.error.ts`'s `RelayDeniedError` (extending `ForbiddenException`) pairs with `src/modules/relay/domain/exception-filters/relay-denied.exception-filter.ts`'s `@Catch(RelayDeniedError, RelayTxDeniedError)` filter, registered on the endpoint via `@UseFilters(...)` in `relay.controller.ts` alongside filters for the module's other domain failure modes.

The three global filters run as `APP_FILTER`s registered once in `src/app.module.ts`; a module-specific domain error's filter instead attaches locally, via `@UseFilters(...)` on the controller method that can throw it — `relay.controller.ts`'s `relay` method lists its filters this way, one per domain error the request can produce.

**Anti-example (do not imitate the pattern):** `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.ts` throws `UnprocessableEntityException` directly from its `catch` blocks — `createOutreach`, `getOutreachOrFail`, `createSubmission`, and others — instead of going through `HttpErrorFactory.from()`.
