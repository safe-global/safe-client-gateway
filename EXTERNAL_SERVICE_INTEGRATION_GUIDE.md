# Integrating an External Service into safe-client-gateway

> A playbook for adding a new upstream HTTP service, modeled on the existing
> **Config Service** integration (`src/datasources/config-api/`). Hand this to
> an agent that needs to wire up a similar service. Replace `Foo` / `foo` with
> your service name throughout.

---

## 1. The layered pattern

Every external service follows the same three-layer shape. Keep these layers
separate — consumers depend on the **interface symbol**, never the concrete class.

```
src/domain/interfaces/foo-api.interface.ts     # IFooApi: Symbol + interface (the contract)
src/datasources/foo-api/foo-api.service.ts      # FooApi implements IFooApi (HTTP + cache)
src/datasources/foo-api/foo-api.module.ts        # binds { provide: IFooApi, useClass: FooApi }
```

Consumers (repositories, "managers") inject `IFooApi` via the symbol and call
domain methods. They never see URLs or caching.

### Reference implementation (read these first)

| Layer | File |
|---|---|
| Interface | `src/domain/interfaces/config-api.interface.ts` |
| Datasource | `src/datasources/config-api/config-api.service.ts` |
| Module | `src/datasources/config-api/config-api.module.ts` |
| Consumer (repo) | `src/modules/chains/domain/chains.repository.ts` |
| Consumer (manager) | `src/modules/transactions/datasources/transaction-api.manager.ts` |

---

## 2. Configuration — base URI and settings

All config is centralized; do **not** read `process.env` outside the config entity.

### 2a. Add a block to the configuration entity

`src/config/entities/configuration.ts` — read env with sensible defaults:

```ts
foo: {
  baseUri: process.env.FOO_BASE_URI || 'https://foo.safe.global/',
  maxSequentialPages: Number.parseInt(
    process.env.FOO_MAX_SEQUENTIAL_PAGES ?? `${3}`,
    10,
  ),
  // a fixed service key, feature toggles, etc.
},
```

(Pattern mirrors `safeConfig` at `configuration.ts:707`.)

### 2b. Mirror it in the test configuration

`src/config/entities/__tests__/configuration.ts` — add the same `foo` block with
deterministic test values (see `safeConfig` at line ~402). Tests build config from
this file, so a missing key here makes `getOrThrow` throw in specs.

### 2c. Validate env vars (only if required/typed)

`src/config/entities/schemas/configuration.schema.ts` (`RootConfigurationSchema`)
validates **raw env vars** that are required or need shape checks. Optional vars
with defaults can be omitted. Example: `SAFE_CONFIG_CGW_KEY: z.string().min(1).optional()`.

### 2d. Document env vars

`.env.sample.json` — add an entry per env var:

```json
{
  "name": "FOO_BASE_URI",
  "description": "Base URI for the Foo Service API",
  "defaultValue": "https://foo.safe.global/",
  "required": false
}
```

### 2e. Read config in the constructor

Inject `IConfigurationService` and resolve **once** in the constructor with
`getOrThrow` (throws at boot if misconfigured) or `get` (optional values):

```ts
this.baseUri = this.configurationService.getOrThrow<string>('foo.baseUri');
```

---

## 3. Public vs. VPC URL pattern (important)

Some services are reachable both publicly and over a private VPC. The codebase
supports **two URLs + a boolean toggle**. Two distinct cases:

### Case A — static, per-service URL (single base URI)
Just one `baseUri` in config (most services). Done.

### Case B — per-chain URL resolved from the Config Service
The Transaction Service URL is **not** static — it is returned per chain by the
Config Service. Each `Chain` carries both a public and a VPC URL
(`chain.schema.ts:98`):

```ts
transactionService:    z.url().transform(removeTrailingSlash),  // public
vpcTransactionService: z.url().transform(removeTrailingSlash),  // private/VPC
```

A single flag selects which to use:
- Env `USE_TX_SERVICE_VPC_URL` → `safeTransaction.useVpcUrl` (`configuration.ts:730`)

Consumers use a **manager** that lazily builds and caches one API client per
`chainId`, picking the URL from the flag (`transaction-api.manager.ts:44`):

```ts
async getApi(chainId: string): Promise<FooApi> {
  const cached = this.fooApiMap[chainId];
  if (cached !== undefined) return cached;

  const chain = await this.configApi.getChain(chainId).then(ChainSchema.parse);
  this.fooApiMap[chainId] = new FooApi(
    this.useVpcUrl ? chain.vpcTransactionService : chain.transactionService,
    /* ...deps... */
  );
  return this.fooApiMap[chainId];
}

destroyApi(chainId: string): void { delete this.fooApiMap[chainId]; }
```

The same `useVpcUrl` pattern appears in `balances-api.manager.ts:90` and
`csv-export/.../export-api.manager.ts:36`. If your service is per-chain, copy a
manager; if it has one global URL, skip the manager and use `baseUri` directly.

---

## 4. The datasource: cache-first HTTP + error wrapping

`FooApi` builds URLs from `baseUri`, fetches through `CacheFirstDataSource`, and
wraps errors with `HttpErrorFactory`.

```ts
@Injectable()
export class FooApi implements IFooApi {
  private readonly baseUri: string;
  private readonly defaultExpirationTimeInSeconds: number;
  private readonly defaultNotFoundExpirationTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>('foo.baseUri');
    this.defaultExpirationTimeInSeconds =
      this.configurationService.getOrThrow<number>('expirationTimeInSeconds.default');
    this.defaultNotFoundExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>('expirationTimeInSeconds.notFound.default');
  }

  async getThing(id: string): Promise<Raw<Thing>> {
    try {
      const url = `${this.baseUri}/api/v1/things/${id}`;
      const cacheDir = CacheRouter.getThingCacheDir(id);
      return await this.dataSource.get<Thing>({
        cacheDir,
        url,
        notFoundExpireTimeSeconds: this.defaultNotFoundExpirationTimeSeconds,
        networkRequest: { params: { /* query params */ } },
        expireTimeSeconds: this.defaultExpirationTimeInSeconds,
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
```

Key conventions:
- **`CacheFirstDataSource.get<T>`** (`cache.first.data.source.ts:72`) returns cache
  hits, else fetches the URL, caches success for `expireTimeSeconds`, and caches
  404s for `notFoundExpireTimeSeconds`.
- **Always wrap** the call in `try/catch` and rethrow via `httpErrorFactory.from(error)`.
- **TTLs** come from `expirationTimeInSeconds.*` config — don't hardcode.

---

## 5. Cache keys via CacheRouter

Add static key/dir builders to `src/datasources/cache/cache.router.ts` — never
construct cache keys inline. A `CacheDir(key, field)` is the cache primitive
(`key` groups related entries; `field` distinguishes variants like pagination).

```ts
static getThingCacheKey(id: string): string {
  return `${id}_${CacheRouter.THING_KEY}`;
}
static getThingCacheDir(id: string): CacheDir {
  return new CacheDir(CacheRouter.getThingCacheKey(id), '');
}
// list with pagination → field encodes the query:
static getThingsCacheDir(args: { limit?: number; offset?: number }): CacheDir {
  return new CacheDir(CacheRouter.getThingsCacheKey(), `${args.limit}_${args.offset}`);
}
```

(See `getChainCacheDir` / `getChainsCacheDir` at `cache.router.ts:558`.)

---

## 6. Validation: `Raw<T>` + zod at the domain boundary

The datasource returns **`Raw<T>`** — an opaque, *unvalidated* type
(`src/validation/entities/raw.entity.ts`). It cannot be used until parsed. The
**repository/domain layer** validates with a zod schema and returns the real type:

```ts
async getThing(id: string): Promise<Thing> {
  const raw = await this.fooApi.getThing(id);
  return ThingSchema.parse(raw);            // Raw<Thing> -> Thing
}
```

- Define schemas under `.../domain/entities/schemas/*.schema.ts`; derive the entity
  type with `z.infer` (see `chain.entity.ts` + `chain.schema.ts`).
- For paginated responses use the **lenient** page schema so one bad row doesn't
  drop the whole page — `buildLenientPageSchema` / `ChainLenientPageSchema`. The
  chains repo logs dropped rows (`chains.repository.ts:68`).
- Normalize at parse time where useful (e.g. `removeTrailingSlash` on URLs,
  `.catch(default)` for forward-compatible fields — see `zk` in `chain.schema.ts:84`).

---

## 7. Cache invalidation via hooks

If upstream data changes are pushed to the CGW (webhooks/events), expose
`clearX` methods on the datasource that delete cache keys, then wire them to the
event handler.

```ts
async clearThing(id: string): Promise<void> {
  await this.cacheService.deleteByKey(CacheRouter.getThingCacheKey(id));
}
```

Wire the event → clear mapping in
`src/modules/hooks/domain/helpers/event-cache.helper.ts` (e.g. the
`CHAIN_UPDATE` handler calls `chainsRepository.clearChain(...)` at line ~513).
Add a debug-log flag if useful (Config Service uses
`features.configHooksDebugLogs`).

---

## 8. Auth headers

Centralize auth in a helper rather than scattering header logic. Attach
conditionally based on environment/flags. Reference:
`src/datasources/network/auth/tx-auth-headers.helper.ts` — only sends a
`Bearer` token when `isDevelopment && !useVpcUrl` and an API key is set (inside
the VPC, network trust replaces the token). Pass the returned headers as
`networkRequest.headers` (or per-request).

---

## 9. Module wiring & DI

```ts
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [HttpErrorFactory, { provide: IFooApi, useClass: FooApi }],
  exports: [IFooApi],
})
export class FooApiModule {}
```

Import `FooApiModule` wherever a repository/manager injects `IFooApi`. Bind to the
**symbol**, export it, and let consumers `@Inject(IFooApi)`.

---

## 10. Tests

- Unit-test the datasource with a mocked `CacheFirstDataSource` /
  `ICacheService` and a fake config — assert URL construction, params, cache dirs,
  TTLs, and `HttpErrorFactory` wrapping. See
  `src/datasources/config-api/config-api.service.spec.ts`.
- Use builders for entities (`chain.builder.ts`) so tests stay resilient to schema growth.
- Remember the test config block from step 2b, or `getOrThrow` will throw in specs.

---

## Checklist for a new service

- [ ] `IFooApi` interface + symbol in `src/domain/interfaces/`
- [ ] `FooApi` datasource (cache-first, error wrapping, config-driven base URI/TTLs)
- [ ] `FooApiModule` binding `{ provide: IFooApi, useClass: FooApi }`, exported
- [ ] Config block in `configuration.ts` **and** `__tests__/configuration.ts`
- [ ] Env vars validated (if required) in `configuration.schema.ts`
- [ ] Env vars documented in `.env.sample.json`
- [ ] `CacheRouter` key/dir builders
- [ ] zod schema(s) + `z.infer` entity; lenient page schema for lists
- [ ] Repository validates `Raw<T>` with `.parse(...)`
- [ ] (Per-chain only) a manager caching a client per `chainId` with public/VPC toggle
- [ ] (If pushed updates) `clearX` methods wired into `event-cache.helper.ts`
- [ ] Auth helper if the service needs credentials
- [ ] `*.spec.ts` for the datasource

---

## Config Service quick reference (the model)

- Base URI: `SAFE_CONFIG_BASE_URI` → `safeConfig.baseUri` (default
  `https://safe-config.safe.global/`), read at `config-api.service.ts:37`.
- Endpoints: `GET /api/v1/chains`, `/api/v1/chains/{id}`,
  `/api/v2/chains/{serviceKey}`, `/api/v2/chains/{serviceKey}/{id}`,
  `/api/v1/safe-apps/`.
- Service key: `SAFE_CONFIG_CGW_KEY` → `safeConfig.cgwServiceKey` (default `CGW`),
  used for v2 endpoints and feature flags (`feature-flag.service.ts:26`).
- Main payload: the `Chain` object — including `transactionService` /
  `vpcTransactionService` (consumed by managers), and `features[]` (feature flags).
- VPC toggle: `USE_TX_SERVICE_VPC_URL` → `safeTransaction.useVpcUrl`.
