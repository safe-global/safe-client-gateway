<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Best Practices

This guide states the cross-cutting TypeScript dos and don'ts that no domain guide owns — type-safety discipline, dependency-injection shape, logging, and error handling that apply the same way in every module regardless of what it does. Biome already enforces part of this at commit time; the rules below cover the gaps it leaves, and freeze today's clean states — zero instances of a given anti-pattern in production code — as a baseline to hold, not a target to reach.

### Parse, don't assert

**Rule:** A type assertion — `as X`, `as unknown as X`, or an angle-bracket cast — never appears on data whose shape the compiler does not already guarantee; external, upstream, and database data is parsed with its Zod schema instead of asserted past. `as const`, and an assertion between two types the compiler can verify overlap (narrowing a union member after its discriminant is checked), are unaffected by this rule — the boundary is the source: an assertion never starts from `unknown`, `any`, or a raw payload, because when the runtime shape isn't guaranteed, that is a parse, not a cast. Test files are exempt via the sanctioned mock-cast idiom.

**Why:** an assertion is a promise to the compiler with no evidence behind it; on data that just crossed a network or database boundary, that promise is exactly the check `Schema.parse()` exists to perform first, so asserting past the boundary throws away the one guarantee it's there to provide.

**Canonical example:** `src/modules/balances/domain/balances.repository.ts`'s `getBalances` calls `BalancesSchema.parse(balances)` on the datasource's `Raw<Array<Balance>>` return value rather than asserting it — see api-dtos-and-validation.md's "`Raw<T>` at the boundary" rule for the mechanism. Four `as unknown as` double-casts exist in prod `src/` today — drift, not precedent; the one to recognize and not imitate is `src/datasources/cache/cache.first.data.source.ts`'s debug-logging block (`// TODO: transient logging for debugging`), which double-casts its generic `data` parameter straight to `Page<Transaction>`/`Safe` to satisfy a logger helper's signature. A mock covering only part of an interface is the one sanctioned double-cast — see testing.md's Mocking idiom rule.

```ts
// Don't — manufactures a type the compiler has no evidence for
const balances = raw as unknown as Array<Balance>;
// Do — the repository parses before trusting it as a domain entity
const balances = BalancesSchema.parse(raw);
```

### No `any`, no suppression comments

**Rule:** `any`, explicit or implicit, never appears in production code; `@ts-ignore` and `@ts-expect-error` never appear in `src/` production code either — a type error there gets fixed at its source, not silenced past.

**Why:** `any` and a suppression comment both switch the compiler off for exactly the line that might be wrong, which undoes what the parse-don't-assert rule above is trying to guarantee all the way to the boundary.

**Canonical example:** biome errors on this today: `noExplicitAny` catches explicit `any` in production code (the test override turns it off for `*.spec.ts`/`*.integration.spec.ts`/`*.e2e-spec.ts`/`__tests__/`). `@ts-ignore`/`@ts-expect-error` carry no biome rule at all — freeze the count instead: zero exist in `src/` production code today, and none get added.

```ts
// Don't — silences the compiler at exactly the line that might be wrong
function decodeParams(data: any) {
  return data.params;
}
// Do — unknown, narrowed by the real schema
function decodeParams(data: unknown): DecodedParams {
  return DecodedParamsSchema.parse(data);
}
```

### No non-null assertions in production code

**Rule:** `value!` — the non-null assertion operator — never appears outside a test file; production code narrows the value first, or throws the layer's own error type, instead of asserting away the possibility of `null`/`undefined`.

**Why:** a wrong assertion doesn't fail where it's written — it fails later, as a raw `TypeError`, at whatever line first dereferences the value, far from the place that actually got it wrong.

**Canonical example:** `src/modules/siwe/domain/siwe.repository.ts`'s `getValidatedSiweMessage` narrows instead of asserting — `const cachedNonce = await this.siweApi.getNonce(...); if (!cachedNonce) { throw new UnauthorizedException('Invalid nonce'); }`. Biome's `noNonNullAssertion` already warns on `!` in production code today (the same test override above turns it off there). Zero non-null assertions (`!.`) exist in prod `src/` today — freeze it. See api-dtos-and-validation.md's "One error funnel per layer" rule for which error type a given layer throws instead of asserting.

```ts
// Don't — asserts presence instead of proving it
function getChainName(chain?: Chain): string {
  return chain!.chainName;
}
// Do — narrow first; throw the layer's own error type otherwise
function getChainName(chain?: Chain): string {
  if (!chain) throw new HttpExceptionNoLog('Chain not found', 404);
  return chain.chainName;
}
```

### `import type` for type-only imports

**Rule:** An import used only as a type is written `import type { X }`, or an inline `type` marker alongside value imports from the same module; a NestJS DI token is the one exception — a Symbol-and-interface pair injected via `@Inject` keeps the Symbol half as a value import, because `@Inject(IFoo)` needs it at runtime even though the property it types is the interface half of the same name.

**Why:** an import that's only ever used as a type but isn't marked as such still looks, to a reader, like it might carry a runtime dependency; marking it `type` keeps a decorator-metadata-heavy codebase honest about which imports the emitted JavaScript actually needs.

**Canonical example:** 1,112 files use `import type` today, while biome's `useImportType` rule is `"off"` — a real, unenforced convention. `src/datasources/db/v1/cached-query-resolver.ts` mixes both halves in one import statement: `import { type ILoggingService, LoggingService } from '@/logging/logging.interface';` — `ILoggingService` is type-only, `LoggingService` (the DI Symbol) is not. See module-structure.md's "Symbol DI wiring" rule for the token pattern itself.

```ts
// Don't — the DI token needs to exist at runtime; type-only strips it
import type { LoggingService } from '@/logging/logging.interface';
// Do — the Symbol is a value; only the interface half is type-only
import { type ILoggingService, LoggingService } from '@/logging/logging.interface';
```

### `ILoggingService`, never `console.*`

**Rule:** Log through the injected `ILoggingService` (`src/logging/logging.interface.ts`), never `console.*`; `main.ts`'s bootstrap error handler is the one sanctioned exception, because it runs before Nest's DI container exists to inject anything into.

**Why:** `ILoggingService` is what makes a log call swappable, testable, and structured — see security.md's "Structured logging only" rule for what belongs in the fields it logs; a stray `console.*` call bypasses all of that silently.

**Canonical example:** `src/logging/logging.interface.ts` declares `ILoggingService` (`info`/`debug`/`error`/`warn`) alongside its `LoggingService` DI Symbol; `src/datasources/db/v1/cached-query-resolver.ts` injects it as `@Inject(LoggingService) private readonly loggingService: ILoggingService` and logs cache hits, misses, and query failures through it. Only `src/main.ts` calls `console.error` today, before the application's own DI container is up; one further hit is a `console.log` inside a JSDoc example comment, not real code.

```ts
// Don't — bypasses the structured logger entirely
console.error('Failed to process job', error);
// Do — routed through the injected logger
this.loggingService.error(asError(error).message);
```

### No silently swallowed errors

**Rule:** A `catch` block always does something: log through `ILoggingService` (debug level for an expected, high-volume failure) or map the failure to the layer's own error type. A `catch` that holds only a comment, or nothing, is never acceptable.

**Why:** an error that reaches a `catch` and stops there disappears completely — no log line, no rethrown error, nothing a reviewer or an on-call engineer can trace back to what actually happened.

**Canonical example:** `src/datasources/db/v1/cached-query-resolver.ts`'s `get` catches a query failure, logs it (`this.loggingService.error(asError(err).message)`), and rethrows as `InternalServerErrorException` rather than swallowing it — see api-dtos-and-validation.md's "One error funnel per layer" rule for which error type a given layer throws. The pattern to not imitate: `src/datasources/cache/cache.router.ts`'s `getRecipientAnalysisCacheDir` catches a `JSON.stringify` failure with only `// fallback: do not update hash if serialization fails` — no log call, no rethrow, nothing.

```ts
// Don't — the failure vanishes with no trace
try {
  hash.update(JSON.stringify(txInfo));
} catch {
  // fallback: do not update hash if serialization fails
}
// Do — logged, so the failure is at least visible afterward
try {
  hash.update(JSON.stringify(txInfo));
} catch (err) {
  this.loggingService.debug(asError(err).message);
}
```

### Injected dependencies are `private readonly`

**Rule:** A constructor-injected dependency is declared `private readonly <name>: <Type>`; a public or mutable constructor parameter is reserved for a value the class deliberately exposes or reassigns, not the default shape for a dependency.

**Why:** a dependency nothing outside the class should touch, and nothing inside it should reassign after construction, is a description `private readonly` enforces at compile time rather than a convention a reviewer has to check by eye.

**Canonical example:** near-universal — 974 `private readonly` constructor parameters across the codebase today, e.g. `src/modules/siwe/domain/siwe.repository.ts`'s `constructor(@Inject(ISiweApi) private readonly siweApi: ISiweApi, @Inject(IConfigurationService) private readonly configurationService: IConfigurationService)`. A single non-`readonly` constructor parameter exists on a guard base class today — drift, not a second convention.

```ts
// Don't — mutable, and reachable from outside the class
constructor(private configurationService: IConfigurationService) {}
// Do — fixed at construction, never reassigned or exposed
constructor(@Inject(IConfigurationService) private readonly configurationService: IConfigurationService) {}
```

### Explicit return types on exported methods

**Rule:** An exported or public method's return type is written explicitly, not left to inference; a `Promise<...>` return in particular is always spelled out on the method signature.

**Why:** an inferred return type changes silently the moment the method body changes — an edit that quietly turns a `Chain` return into `Chain | undefined` is a type error at every call site with an explicit return type, and a silent behavior change without one.

**Canonical example:** `src/modules/chains/routes/chains.service.ts`'s `getChain(chainId: string): Promise<Chain>` — and every other public method on the class — spells out its return type; this holds near-universally across sampled services and repositories today.

```ts
// Don't — the return type is whatever the body happens to infer to
async getChain(chainId: string) {
  return new Chain(await this.chainsRepository.getChain(chainId));
}
// Do — explicit, so a body edit that changes the shape is caught at every call site
async getChain(chainId: string): Promise<Chain> {
  return new Chain(await this.chainsRepository.getChain(chainId));
}
```

### Named constants over inline magic values

**Rule:** A domain threshold — a max length, a size cap, a fixed numeric bound — is declared once as a named constant and imported at every site that needs it; the same bound is never re-typed as a bare numeric literal at a second call site.

**Why:** two call sites that happen to encode the same rule as separate literals will drift the moment only one of them is updated; a shared named constant turns the second site's staleness into a one-line diff instead of a silent divergence.

**Canonical example:** `src/routes/common/constants.ts` declares `CHAIN_ID_MAXLENGTH = 78` (alongside `ADDRESS_LENGTH`, `NULL_ADDRESS`, `HEX_BYTES_LENGTH`); `src/modules/chains/domain/entities/schemas/chain-id.schema.ts` imports it into `ChainIdSchema`. `src/modules/counterfactual-safes/routes/entities/counterfactual-safe.dto.entity.ts` shows both sides in the same schema object: `chainId: ChainIdSchema` reaches the constant transitively, while later in the same schema object, `saltNonce: NumericStringSchema.pipe(z.string().max(78))` re-types the identical bound as a bare `78` instead of importing `CHAIN_ID_MAXLENGTH` — drift, not a second convention.

```ts
// Don't — the same bound as CHAIN_ID_MAXLENGTH, re-typed as a bare literal
saltNonce: NumericStringSchema.pipe(z.string().max(78)),
// Do — the shared constant, so the two never drift apart
saltNonce: NumericStringSchema.pipe(z.string().max(CHAIN_ID_MAXLENGTH)),
```
