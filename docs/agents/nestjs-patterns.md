<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# NestJS Patterns

NestJS offers many primitives. This repo uses a specific subset, in specific ways, and deliberately leaves the rest unused. This guide is the inventory: for each primitive, what it is used for here, where instances live, and what a new one must look like. Reaching for a Nest feature that has no entry below means either that this repo does not use it, or that the pattern is not yet established — both are reasons to check before introducing it.

The HTTP platform is Fastify, not Express. Anything that touches the request or response object types it accordingly (`FastifyReply`, `FastifyRequest`); see the `Fastify` notes on individual rules below.

Scope boundaries: module *layout* and naming are owned by `module-structure.md`; validation-schema and DTO *content* by `api-dtos-and-validation.md`; guard *placement* and identity by `security.md`; env-var declaration by `configuration-and-flags.md`. This guide covers only how the Nest primitives themselves are used.

## Provider registration: four forms, distinct jobs

**Rule:** A provider is registered in one of four forms, chosen by what is being provided:

| Form | Use it for | Count today |
|---|---|---|
| `useClass` | The default. Binds a Symbol DI token to the one class that implements its interface. | 91 |
| `useFactory` | A provider whose construction needs config or third-party client setup that a constructor cannot express. Always paired with `inject: [...]`. | 39 |
| `useValue` | A fixed value or a test double. In production code, effectively only for constants. | 4 |
| `useExisting` | A second token that must resolve to the *same instance* as an already-registered provider — an alias, never a second copy. | 4 |

**Why:** `useExisting` and `useClass` look interchangeable and are not: registering the same class under two tokens with `useClass` constructs it twice, so a class holding a connection, a consumer, or an in-process cache silently gets two of them. The four-way split also keeps `useFactory` — the only form that can read config at construction time — recognizable at a glance.

**Canonical example:** `src/modules/chains/chains.module.ts` shows the default form — `{ provide: IChainsRepository, useClass: ChainsRepository }`, with `IChainsRepository` in `exports` so other modules can inject it. `src/datasources/jwt/jwt.module.ts` shows `useFactory` (`jwtClientFactory` wraps the `jsonwebtoken` library into the shape `IJwtService` needs). `src/modules/queues/datasources/queues-api.module.ts` shows the alias case: `{ provide: QueueReadiness, useExisting: IQueuesApiService }` — the readiness probe must observe the live AMQP client, not a second one. `src/modules/notifications/domain/push/push-notification.module.ts` does the same for `IPushNotificationService`.

```ts
// Don't — constructs PushNotificationService twice; the two copies diverge
providers: [
  PushNotificationService,
  { provide: IPushNotificationService, useClass: PushNotificationService },
]
// Do — one instance, reachable under both names
providers: [
  PushNotificationService,
  { provide: IPushNotificationService, useExisting: PushNotificationService },
]
```

## Modules declare their own wiring; `AppModule` declares only the global layer

**Rule:** A feature module lists its `imports` (the modules whose tokens it injects), `providers` (its own token bindings plus its route services), `controllers`, and `exports` (only the tokens other modules may inject — in practice the repository interface). It never registers a global interceptor, filter, or guard. Those are registered exactly once, in `src/app.module.ts`, via `APP_INTERCEPTOR` / `APP_FILTER` / `APP_GUARD`.

**Why:** a globally-scoped provider registered inside a feature module applies to every route in the application while looking local, so its blast radius is invisible at the place it is declared. Keeping the global layer in one file makes the whole cross-cutting stack readable in one screen.

**Canonical example:** `src/app.module.ts` registers the entire global layer — three `APP_INTERCEPTOR`s (`RouteLoggerInterceptor`, `CacheControlInterceptor`, `NullResponseInterceptor`), one `APP_GUARD` (`BlocklistGuard`), three `APP_FILTER`s (`GlobalErrorFilter`, `DataSourceErrorFilter`, `ZodErrorFilter`) — and applies `ClsMiddleware` before `NotFoundLoggerMiddleware` through `configure(consumer)`, because the CLS middleware generates the request ids the logger later reads. `src/modules/chains/chains.module.ts` is the feature-module counterpart: imports, one `useClass` binding, two route services, two controllers, one export.

## Guards: request admission only

**Rule:** A guard answers one question — may this request proceed — and returns `boolean` or throws. It lives in the owning module's `routes/guards/` directory, named `*.guard.ts`. A guard never mutates domain state, never performs an upstream write, and never returns data; the one thing it may attach to the request is the verified identity, read back through a param decorator rather than by the controller reaching into the request object.

**Why:** a guard runs before the validation pipe, so its input is unvalidated; work done there operates on unparsed data and, on the failure path, has already happened by the time the request is rejected. Guards are also invisible in a controller's method body — hiding a side effect in one puts it where no reader of the handler will look for it.

**Canonical example:** eighteen guards exist, all under a `routes/guards/` directory (or `routes/common/` for the cross-cutting ones). `src/modules/auth/routes/guards/auth.guard.ts` verifies the JWT and attaches the payload under `AuthGuard.AUTH_PAYLOAD_REQUEST_PROPERTY`; the handler reads it via the `@Auth()` param decorator (`src/modules/auth/routes/decorators/auth.decorator.ts`), never via `request[...]` directly. The route-scoped rate limiters (`spaces-address-book-rate-limit.guard.ts`, `oidc-auth-rate-limit.guard.ts`), webhook-signature guards (`tenderly-signature.guard.ts`, `billing-webhook-auth.guard.ts`) and plan gates (`entitlement.guard.ts`, an abstract base subclassed once per gated feature — `safe-seats.guard.ts`) follow the same shape. Which routes *must* carry a guard is `security.md`'s rule, not this one.

Before adding a guard, check whether an existing one extends: `AuthGuard`, `OptionalAuthGuard`, `RateLimitGuard`, `CaptchaGuard`, and `BasicAuthGuard` already cover the common cases, and #3217's review pushed back on a new webhook guard for exactly this reason — "the code here is mostly duplicated".

## Interceptors: response-shape and observability concerns only

**Rule:** An interceptor exists to apply one uniform transformation to the response or to observe the request; it never contains business logic and never varies its behavior per module. Three exist, all global, all in `src/routes/common/interceptors/`. A new one needs a concern that is genuinely uniform across every route — otherwise the logic belongs in the route service.

**Why:** an interceptor's effect is applied everywhere but declared in one place far from any handler, which makes a per-route behavior expressed as an interceptor effectively undebuggable from the handler outward.

**Canonical example:** `NullResponseInterceptor` maps a top-level `null` to `undefined` so Fastify emits an empty body rather than the literal `null` the Express adapter never produced — a platform-compatibility concern, uniform by definition. `CacheControlInterceptor` sets `Cache-Control: no-cache`, guarding on `response.sent` first. `RouteLoggerInterceptor` emits the structured request log. All three type the response as `FastifyReply` via `context.switchToHttp().getResponse<FastifyReply>()`.

```ts
// Do — the Fastify reply type, and the guard against a sent response
const response = context.switchToHttp().getResponse<FastifyReply>();
if (!response.sent) {
  response.header('Cache-Control', 'no-cache');
}
```

## Pipes: `ValidationPipe(Schema)` is the pattern; a custom pipe is the exception

**Rule:** Input validation goes through `new ValidationPipe(<ZodSchema>)` from `src/validation/pipes/validation.pipe.ts`, instantiated inline at the parameter. A custom `PipeTransform` is written only when the transform needs a dependency injected — and then it is `@Injectable()`, declared in the module's `providers`, and referenced by class rather than by instance.

**Why:** `ValidationPipe` is generic over the schema (`ValidationPipe<T extends ZodType>` returning `z.infer<T>`), so one pipe covers every input shape in the repo and the schema stays the single source of truth. It throws `ZodErrorWithCode`, which `ZodErrorFilter` turns into a 422 — a hand-rolled pipe throwing something else bypasses that funnel and produces a different status code for the same class of failure.

**Canonical example:** exactly two pipes exist. `src/validation/pipes/validation.pipe.ts` is the generic one, defaulting to `HttpStatus.UNPROCESSABLE_ENTITY` with the code overridable per call site. `src/modules/spaces/routes/pipes/space-id.pipe.ts` is the sanctioned custom case: it needs `ISpacesRepository` injected to resolve a Space UUID to its numeric primary key, so it is `@Injectable()`, rejects malformed input with a `BadRequestException` before touching the repository, and is referenced as `SpaceIdPipe` (the class) so Nest constructs it with its dependency.

```ts
// Don't — bare param access; nothing validates it
@Get(':chainId/safes/:safeAddress')
async getSafe(@Param('chainId') chainId: string) { … }

// Do — the schema is the contract, and the pipe enforces it
@Get(':chainId/safes/:safeAddress')
async getSafe(
  @Param('chainId', new ValidationPipe(ChainIdSchema)) chainId: string,
) { … }
```

## Exception filters: three global, one per-controller when the status is route-specific

**Rule:** Three filters are registered globally in `AppModule` and cover the normal paths. A per-controller filter, applied with `@UseFilters(...)`, is added only for an error whose HTTP status is meaningful for that route and nowhere else. It is declared as a `*.filter.ts` beside its `*.error.ts` in the module's `routes/`, `@Catch()`es exactly that error type, and does nothing but map it to a status and a body.

| Filter | Catches | Emits |
|---|---|---|
| `GlobalErrorFilter` | Anything unhandled | The catch-all response |
| `DataSourceErrorFilter` | `DataSourceError` | `exception.code`, or 503 when the code is undefined |
| `ZodErrorFilter` | `ZodError` and `ZodErrorWithCode` | 422 with issue detail for input errors; **502 with a bare `Bad gateway`** for a domain/upstream parse failure |

**Why:** `ZodErrorFilter`'s asymmetry is the load-bearing detail. A `ZodErrorWithCode` came from `ValidationPipe`, so it is the caller's input and safe to describe in detail; a plain `ZodError` came from a `Schema.parse()` on an upstream or database payload, whose issue text can contain internal data — so it is answered with 502 and no detail. A filter that flattens the two, or a new one that echoes the issues of a domain-level `ZodError`, leaks internal shape to clients.

**Canonical example:** `src/modules/hooks/routes/filters/event-protocol-changed.filter.ts` is the per-controller case — `@Catch(EventProtocolChangedError)` mapping to `410 Gone`, applied at `hooks.controller.ts:48` via `@UseFilters(EventProtocolChangedFilter)`, because "unsupported protocol for this kind of event" is a webhook-route concept only. `relay.controller.ts` does the same for its relayer-availability errors. Which error type a given layer throws in the first place is `api-dtos-and-validation.md`'s "One error funnel per layer" rule.

## DTOs, entities, and domain types

**Rule:** Three distinct kinds of type exist, and each has one home:

| Kind | Lives in | Shape |
|---|---|---|
| Domain entity | `<module>/domain/entities/*.entity.ts` | The Zod schema and the type inferred from it, in the same file. |
| Route DTO / response | `<module>/routes/entities/*.dto.entity.ts`, `*.entity.ts` | A class with `@ApiProperty` decorators, declared `implements z.infer<typeof Schema>` so the compiler checks the two against each other. |
| Persistence entity | `<module>/datasources/entities/*.entity.db.ts` | The TypeORM entity, `implements` its domain type, with a paired `RowSchema`. |

**Why:** the `implements z.infer<...>` link is what stops the Swagger surface and the validation schema from drifting apart — without it, adding a field to the schema and forgetting the DTO is a silent documentation bug rather than a compile error. Keeping the schema and its inferred type in one file is a review expectation, not just a preference: "we usually keep schemas and type inferred in the same file `*.entity.ts`, could we change it in this folder please" (#3200).

**Canonical example:** see `api-dtos-and-validation.md` for the schema/DTO pairing itself and the four-representations checklist that applies when a persisted field changes. Two review remarks recur on the DTO half specifically: an optional field is annotated `@ApiPropertyOptional`, not `@ApiProperty` (#3200), and optional (`field?: T`) and nullable (`field: T | null`) are different declarations — a DTO that claims both without the schema allowing both is a finding (#3223).

## DI gotchas

**Rule:** Three specific traps, each with an established answer:

- **Circular module imports** are resolved with `forwardRef(() => OtherModule)` on *both* sides of the cycle, never by duplicating a provider to break it.
- **Everything is a singleton.** No `Scope.REQUEST` or `Scope.TRANSIENT` provider exists in this repo. Per-request state lives in CLS (`ClsMiddleware`), not in a request-scoped provider.
- **An injected dependency is typed as its interface, not its implementing class** — `@Inject(IFoo) private readonly foo: IFoo`, never `: FooService`.

**Why:** a request-scoped provider silently changes the lifecycle of everything that injects it, and since no provider here is request-scoped, introducing one makes a singleton graph partially per-request in a way nothing declares. Typing an injected dependency as the concrete class defeats the Symbol-DI seam entirely: the token says "any implementation" while the type says "this one", so a test double or a second implementation stops compiling for no structural reason.

**Canonical example:** `src/modules/auth/auth.module.ts`, `users.module.ts`, `spaces.module.ts`, and `counterfactual-safes.module.ts` form a genuine cycle (auth ↔ users ↔ spaces) and each wraps the others in `forwardRef`. About 11 DI sites in the repo type a Symbol-injected dependency as the concrete class — drift, not a second convention; `module-structure.md` owns the Symbol-DI recipe itself.

## Configuration access

**Rule:** Application code reads configuration through the injected `IConfigurationService` — `this.configurationService.getOrThrow<T>('path.to.key')`, called in the constructor and cached on a field. `process.env` is read only inside `src/config/`: `configuration.ts` (which maps the environment into the config tree), `configuration.validator.ts`, and `postgres.config.ts`. Nowhere else.

**Why:** `getOrThrow` fails at startup when a key is missing, whereas a `process.env` read fails at the first request that happens to need it — and the value is untyped and unvalidated when it does arrive. The `configuration.ts` + `RootConfigurationSchema` pair is what makes a missing or malformed variable a boot failure; a direct `process.env` read outside `src/config/` is invisible to both.

**Canonical example:** `src/modules/siwe/domain/siwe.repository.ts` reads `this.configurationService.getOrThrow<number>(…)` for its clock-skew bound in the constructor. This is also `security.md`'s and `configuration-and-flags.md`'s rule restated — those guides own the declaration side (`configuration.ts`, `RootConfigurationSchema`, `.env.sample.json`, no fallback defaults for secrets) and the feature-flag conventions. Two recurring review remarks live on this line: a hard-coded timeout, batch size, or TTL belongs in config ("config service :)" — #3214), and a TTL key is named `*TtlSeconds` for consistency with its neighbors (#3197).

## What this repo does not use

Custom decorators exist but are rare — three in total (`@Auth()`, `@PaginationData()`, `@RouteUrl()`), each a `createParamDecorator` that reads one thing off the request. There are no custom class decorators, no `@nestjs/cqrs`, no dynamic-module builders beyond the `useFactory` providers listed above, no request-scoped providers, and no `@nestjs/passport` strategies — authentication is the guards in `src/modules/auth/routes/guards/`. Introducing any of these is a new pattern for this repo, not an application of an existing one.
