---
name: cgw-nestjs-patterns
description: Use when adding or changing a NestJS primitive in safe-client-gateway - a module, a provider registration, a guard, an interceptor, a pipe, an exception filter, a param decorator, or a DI wiring. Covers which of the four provider forms to use (useClass, useFactory, useValue, useExisting) and why useExisting is not interchangeable with useClass, why the global interceptor/filter/guard layer lives only in AppModule, what a guard may and may not do, the ValidationPipe(Schema) pattern, the three global filters and ZodErrorFilter's deliberate 422-vs-502 asymmetry, DTO-vs-entity-vs-domain-type homes, forwardRef for circular modules, the singleton-only rule, and IConfigurationService instead of process.env. Triggers on "Nest module", "provider", "interceptor", "pipe", "exception filter", "DI", "inject", "circular dependency", "decorator".
---

# CGW NestJS Patterns

Read **[docs/agents/nestjs-patterns.md](../../../docs/agents/nestjs-patterns.md)** before adding a Nest primitive. This skill is a loader; the doc is the content.

NestJS offers many primitives; this repo uses a specific subset in specific ways. **A primitive with no entry in that doc is a new pattern for this repo, not an application of an existing one** — check before introducing it. Notably absent: request-scoped providers, `@nestjs/cqrs`, passport strategies, custom class decorators.

The traps that cost the most:

- **`useExisting` ≠ `useClass`.** Registering one class under two tokens with `useClass` constructs it twice — two AMQP clients, two in-process caches. Use `useExisting` for an alias.
- **Global interceptors, filters, and guards belong only in `src/app.module.ts`** via `APP_INTERCEPTOR` / `APP_FILTER` / `APP_GUARD`. A globally-scoped provider registered inside a feature module applies everywhere while looking local.
- **`ZodErrorFilter`'s asymmetry is deliberate**: a `ZodErrorWithCode` from `ValidationPipe` is the caller's input, answered 422 with detail; a plain `ZodError` from a `Schema.parse()` on upstream data is answered 502 with a bare message, because its issue text can carry internal shape.
- **Everything is a singleton.** Per-request state lives in CLS, not in a `Scope.REQUEST` provider.
- **Inject the interface, not the class**: `@Inject(IFoo) private readonly foo: IFoo`.

Module *layout* and naming are **cgw-module-structure**; schema and DTO *content* are **cgw-api-dtos**; guard *placement* is **cgw-security**.
