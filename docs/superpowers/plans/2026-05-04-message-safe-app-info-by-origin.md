<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Message SafeApp resolution by origin URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the messages route to resolve a Safe App via the `origin` URL (the same way transactions do today), drop the `safeAppId` plumbing the queue service no longer carries, and surface a `SafeAppInfo` object on the response while keeping `safeAppId` as a deprecated-but-populated field for legacy clients.

**Architecture:** Extract the existing transaction-side `SafeAppInfoMapper` to a shared module-neutral home (`src/modules/safe-apps/mappers/`), generalize it to return the domain `SafeApp` from an origin string, and have both transactions and messages project that into their respective response shapes. The messages domain entity drops `safeAppId` entirely; the route entity gains `safeAppInfo` and a deprecated `safeAppId` populated from `safeApp.id`.

**Tech Stack:** TypeScript, NestJS, Jest, zod schemas, viem types.

**Spec:** `docs/superpowers/specs/2026-05-04-message-safe-app-info-by-origin-design.md`

---

## File Structure

**Created:**
- `src/modules/safe-apps/mappers/safe-app-info.mapper.ts` (moved + generalized)
- `src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts` (moved + reshaped)

**Deleted:**
- `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts`
- `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.spec.ts`

**Modified:**
- `src/modules/safe-apps/safe-apps.module.ts` — provide + export new mapper
- `src/modules/transactions/transactions.module.ts` — drop the now-deleted local provider
- `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts` — call new mapper, project to `SafeAppInfo`
- `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts` — same
- `src/modules/transactions/routes/mappers/common/human-description.mapper.ts` — same
- `src/modules/queue/queue.interface.ts` — drop `safeAppId` arg from `postMessage`
- `src/modules/queue/queue.service.ts` — drop `safeAppId` arg from `postMessage` impl
- `src/modules/queue/mappers/message.mapper.ts` — drop `safeAppId: null`
- `src/modules/messages/domain/entities/message.entity.ts` — drop `safeAppId`
- `src/modules/messages/domain/entities/__tests__/message.entity.spec.ts` — adjust schema test fixtures
- `src/modules/messages/domain/messages.repository.interface.ts` — drop `safeAppId` arg
- `src/modules/messages/domain/messages.repository.ts` — drop `safeAppId` arg
- `src/modules/messages/routes/messages.service.ts` — drop `safeAppId` from internal call
- `src/modules/messages/routes/messages.controller.ts` — no longer threads `safeAppId` to service
- `src/modules/messages/routes/entities/message.entity.ts` — add `safeAppInfo`, deprecate `safeAppId`/`name`/`logoUri`
- `src/modules/messages/routes/entities/message-item.entity.ts` — same
- `src/modules/messages/routes/entities/create-message.dto.entity.ts` — mark `safeAppId` deprecated in OpenAPI
- `src/modules/messages/routes/mappers/message-mapper.ts` — origin-URL lookup, populate new fields
- `src/modules/messages/messages.module.ts` — DI wiring (no actual change; `SafeAppsModule` already imported)
- `src/modules/messages/routes/messages.controller.integration.spec.ts` — assert new response shape

---

## Task 1: Move `SafeAppInfoMapper` to `safe-apps/mappers/` (no behavior change)

**Files:**
- Move: `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts` → `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`
- Move: `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.spec.ts` → `src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts`
- Modify: `src/modules/safe-apps/safe-apps.module.ts`
- Modify: `src/modules/transactions/transactions.module.ts`
- Modify: `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts`
- Modify: `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts`
- Modify: `src/modules/transactions/routes/mappers/common/human-description.mapper.ts`

- [ ] **Step 1.1: Move the source + spec via `git mv`**

```bash
mkdir -p src/modules/safe-apps/mappers
git mv src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts \
       src/modules/safe-apps/mappers/safe-app-info.mapper.ts
git mv src/modules/transactions/routes/mappers/common/safe-app-info.mapper.spec.ts \
       src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts
```

- [ ] **Step 1.2: Update the `SafeAppsModule` to provide and export the mapper**

Edit `src/modules/safe-apps/safe-apps.module.ts`:

```ts
// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import { SafeAppsController } from '@/modules/safe-apps/routes/safe-apps.controller';
import { SafeAppsService } from '@/modules/safe-apps/routes/safe-apps.service';
import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';

@Module({
  imports: [ConfigApiModule],
  providers: [
    {
      provide: ISafeAppsRepository,
      useClass: SafeAppsRepository,
    },
    SafeAppsService,
    SafeAppInfoMapper,
  ],
  controllers: [SafeAppsController],
  exports: [ISafeAppsRepository, SafeAppInfoMapper],
})
export class SafeAppsModule {}
```

- [ ] **Step 1.3: Drop the redundant local provider in `TransactionsModule`**

In `src/modules/transactions/transactions.module.ts`:
1. Remove the import line `import { SafeAppInfoMapper } from '@/modules/transactions/routes/mappers/common/safe-app-info.mapper';`.
2. Remove `SafeAppInfoMapper,` from the `providers` array.
3. Confirm `SafeAppsModule` is in `imports` (it already is — verify before saving).

- [ ] **Step 1.4: Update consumers' import paths**

In each of these three files, change:

```ts
import { SafeAppInfoMapper } from '@/modules/transactions/routes/mappers/common/safe-app-info.mapper';
```

to:

```ts
import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
```

Files:
- `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts`
- `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts`
- `src/modules/transactions/routes/mappers/common/human-description.mapper.ts`

- [ ] **Step 1.5: Run the affected unit suites to confirm zero behavior change**

Run: `yarn test:unit --watchman=false --testPathPattern='safe-app-info|multisig-transaction.mapper|multisig-transaction-details|human-descriptions'`

Expected: all green.

- [ ] **Step 1.6: Run lint, format, env:validate**

```bash
yarn lint
yarn format
yarn env:validate
```

Expected: no errors.

- [ ] **Step 1.7: Commit**

```bash
git add src/modules/safe-apps/ \
        src/modules/transactions/transactions.module.ts \
        src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts \
        src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts \
        src/modules/transactions/routes/mappers/common/human-description.mapper.ts
git commit -m "refactor: move SafeAppInfoMapper to safe-apps module"
```

---

## Task 2: Generalize the mapper to return `SafeApp` from an origin string

The mapper currently takes a `MultisigTransaction` and returns `SafeAppInfo`. Generalize it to take a plain `(chainId, origin, logContext?)` and return the **domain `SafeApp`** so each caller can project to its own response shape (transactions → `SafeAppInfo`, messages → `SafeAppInfo` + `safeAppId`). Rename to `SafeAppByOriginMapper.findByOrigin` to reflect what it actually does.

**Files:**
- Modify: `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`
- Modify: `src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts`
- Modify: `src/modules/safe-apps/safe-apps.module.ts`
- Modify: `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts`
- Modify: `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts`
- Modify: `src/modules/transactions/routes/mappers/common/human-description.mapper.ts`

- [ ] **Step 2.1: Rewrite the spec for the new signature (test first)**

Replace the contents of `src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts` with:

```ts
// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { SafeAppByOriginMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
import type { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { safeAppBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app.builder';

const mockSafeAppsRepository = {
  getSafeApps: jest.fn(),
  getSafeAppById: jest.fn(),
} as jest.MockedObjectDeep<ISafeAppsRepository>;

const mockLoggingService = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('SafeAppByOriginMapper', () => {
  let mapper: SafeAppByOriginMapper;
  const chainId = faker.string.numeric();

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new SafeAppByOriginMapper(
      mockSafeAppsRepository,
      mockLoggingService,
    );
  });

  it('returns null when origin is null', async () => {
    const result = await mapper.findByOrigin(chainId, null);
    expect(result).toBeNull();
    expect(mockSafeAppsRepository.getSafeApps).not.toHaveBeenCalled();
  });

  it('returns null and logs debug when origin is invalid JSON', async () => {
    const result = await mapper.findByOrigin(chainId, 'not-json', 'ctx=xyz');
    expect(result).toBeNull();
    expect(mockSafeAppsRepository.getSafeApps).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.stringContaining('ctx=xyz'),
    );
  });

  it('returns null and logs info when no SafeApp matches the origin url', async () => {
    mockSafeAppsRepository.getSafeApps.mockResolvedValue([]);
    const url = 'https://example.com';
    const result = await mapper.findByOrigin(
      chainId,
      JSON.stringify({ name: 'X', url }),
      'ctx=xyz',
    );
    expect(result).toBeNull();
    expect(mockSafeAppsRepository.getSafeApps).toHaveBeenCalledWith({
      chainId,
      onlyListed: false,
      url,
    });
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      expect.stringContaining('ctx=xyz'),
    );
  });

  it('returns the matching SafeApp domain entity', async () => {
    const url = 'https://app.example';
    const safeApp = safeAppBuilder().with('url', url).build();
    mockSafeAppsRepository.getSafeApps.mockResolvedValue([safeApp]);

    const result = await mapper.findByOrigin(
      chainId,
      JSON.stringify({ name: 'App', url }),
    );

    expect(result).toBe(safeApp);
  });

  it('returns null when origin parses but has no url field', async () => {
    const result = await mapper.findByOrigin(
      chainId,
      JSON.stringify({ name: 'App' }),
    );
    expect(result).toBeNull();
    expect(mockSafeAppsRepository.getSafeApps).not.toHaveBeenCalled();
  });
});
```

If `safeAppBuilder` does not exist at that import path, search the codebase: `grep -rn "function safeAppBuilder" src/modules/safe-apps`. Use the actual path. If no builder exists, write a minimal one inline in the test (`{ id: 1, name: 'X', url, iconUrl: null, ... }`).

- [ ] **Step 2.2: Run the spec — confirm it fails**

Run: `yarn test:unit --watchman=false --testPathPattern='safe-apps/mappers/safe-app-info'`

Expected: FAIL with errors about `SafeAppByOriginMapper` not exported and `findByOrigin` not defined.

- [ ] **Step 2.3: Rewrite the mapper to the new signature**

Replace `src/modules/safe-apps/mappers/safe-app-info.mapper.ts` with:

```ts
// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import type { SafeApp } from '@/modules/safe-apps/domain/entities/safe-app.entity';

/**
 * Resolves a {@link SafeApp} from a transaction- or message-shaped `origin`
 * string of the form `{"name":"...","url":"..."}` by looking the URL up in
 * the SafeApps repository. Returns the domain entity so callers can project
 * to their own response shape (e.g. {@link SafeAppInfo}).
 *
 * Logs:
 * - `debug` when origin is not valid JSON
 * - `info` when no Safe App matches the parsed URL
 *
 * `logContext` is interpolated into log lines (e.g. `safeTxHash=0x...` or
 * `messageHash=0x...`) so callers retain identifying context at scale.
 */
@Injectable()
export class SafeAppByOriginMapper {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async findByOrigin(
    chainId: string,
    origin: string | null,
    logContext: string = '',
  ): Promise<SafeApp | null> {
    const url = this.extractOriginUrl(origin, logContext);
    if (!url) return null;

    const [safeApp] = await this.safeAppsRepository.getSafeApps({
      chainId,
      onlyListed: false,
      url,
    });
    if (!safeApp) {
      this.loggingService.info(
        `No Safe Apps matching the origin url ${url} (${logContext})`,
      );
      return null;
    }

    return safeApp;
  }

  private extractOriginUrl(
    origin: string | null,
    logContext: string,
  ): string | null {
    if (!origin) return null;
    try {
      const parsed = JSON.parse(origin) as { url?: string };
      return parsed.url ?? null;
    } catch {
      this.loggingService.debug(
        `Origin is not valid JSON (${logContext}). origin=${origin}`,
      );
      return null;
    }
  }
}

// Backwards-compatible alias so existing imports keep working until they
// migrate. The name `SafeAppInfoMapper` is now misleading (returns SafeApp,
// not SafeAppInfo) so consumers should rename their imports to
// `SafeAppByOriginMapper`.
/** @deprecated Use {@link SafeAppByOriginMapper}. */
export { SafeAppByOriginMapper as SafeAppInfoMapper };
```

The aliased export keeps Step 1's transaction consumers compiling for one
more step before Step 2.5 renames their references.

- [ ] **Step 2.4: Run the spec — confirm it passes**

Run: `yarn test:unit --watchman=false --testPathPattern='safe-apps/mappers/safe-app-info'`

Expected: PASS (all 5 tests).

- [ ] **Step 2.5: Update transaction consumers to project locally and use the new name**

For each of the three transaction-side consumers, replace the previous mapper call with `findByOrigin` + a local `new SafeAppInfo(...)` projection. The IPFS/CF-IPFS URL replacement that used to live in the mapper now lives at the projection site.

(a) `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts`

```ts
// At the top of the file, replace the existing import:
import { SafeAppByOriginMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';

// In the constructor:
constructor(
  // ...other params...
  private readonly safeAppByOrigin: SafeAppByOriginMapper,
  // ...
) {}

// Replace the existing safeAppInfoMapper.mapSafeAppInfo(...) call.
// Find the line that currently reads:
//   const safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction);
// and replace it with:
const safeApp = await this.safeAppByOrigin.findByOrigin(
  chainId,
  transaction.origin,
  `safeTxHash=${transaction.safeTxHash}`,
);
const safeAppInfo = safeApp
  ? new SafeAppInfo(
      safeApp.name,
      safeApp.url.replace('ipfs.io', 'cloudflare-ipfs.com'),
      safeApp.iconUrl,
    )
  : null;
```

(b) `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper.ts`

Same change. The current call in this file looks like:

```ts
this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction),
```

Replace with the same pattern as (a). Constructor field renames from `safeAppInfoMapper: SafeAppInfoMapper` to `safeAppByOrigin: SafeAppByOriginMapper`.

(c) `src/modules/transactions/routes/mappers/common/human-description.mapper.ts`

Around line 167 the current call is:

```ts
? await this.safeAppInfoMapper.mapSafeAppInfo(chainId, transaction)
```

Replace with the projection block from (a). Constructor field renamed similarly.

(d) `src/modules/safe-apps/safe-apps.module.ts`

Update the provider + export to use the new class name:

```ts
import { SafeAppByOriginMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';

// In providers array, replace:
//   SafeAppInfoMapper,
// with:
SafeAppByOriginMapper,

// In exports array, replace:
//   ISafeAppsRepository, SafeAppInfoMapper,
// with:
ISafeAppsRepository, SafeAppByOriginMapper,
```

- [ ] **Step 2.6: Run the affected suites + full unit suite**

```bash
yarn test:unit --watchman=false --testPathPattern='safe-app|multisig-transaction.mapper|multisig-transaction-details|human-descriptions'
yarn test:unit --watchman=false
```

Expected: all green.

- [ ] **Step 2.7: Drop the deprecated alias from the mapper**

Now that consumers import `SafeAppByOriginMapper` directly, delete the alias block at the bottom of `safe-app-info.mapper.ts`:

```ts
// Remove this block entirely:
/** @deprecated Use {@link SafeAppByOriginMapper}. */
export { SafeAppByOriginMapper as SafeAppInfoMapper };
```

Re-run unit suite to confirm nothing else still imports the old name:

```bash
grep -rn "SafeAppInfoMapper" src/
```

Expected: no matches.

```bash
yarn test:unit --watchman=false
```

Expected: all green.

- [ ] **Step 2.8: Lint, format**

```bash
yarn lint
yarn format
```

Expected: no errors.

- [ ] **Step 2.9: Commit**

```bash
git add src/modules/safe-apps/ src/modules/transactions/
git commit -m "refactor: SafeAppByOriginMapper returns domain SafeApp from origin string

Generalize the previously transaction-specific mapper so it can serve
both transactions and messages. The mapper now takes (chainId, origin,
logContext?) and returns the domain SafeApp; each consumer projects it
to its own response shape (SafeAppInfo for transactions; SafeAppInfo +
safeAppId for messages, in a follow-up commit)."
```

---

## Task 3: Drop `safeAppId` from the queue layer

The queue service does not accept or return `safeAppId` end-to-end. The argument is vestigial in `IQueue.postMessage`, the impl ignores it, and `mapQueueToMessage` writes a hard-coded `null`.

**Files:**
- Modify: `src/modules/queue/queue.interface.ts`
- Modify: `src/modules/queue/queue.service.ts`
- Modify: `src/modules/queue/mappers/message.mapper.ts`

- [ ] **Step 3.1: Drop `safeAppId` from `IQueue.postMessage`**

In `src/modules/queue/queue.interface.ts`, locate the `postMessage` signature. It currently includes `safeAppId: number | null;`. Remove that single line.

- [ ] **Step 3.2: Drop `safeAppId` from the `QueueService.postMessage` impl**

In `src/modules/queue/queue.service.ts` find the args type for `postMessage`:

```ts
async postMessage(args: {
  chainId: string;
  safeAddress: Address;
  message: unknown;
  safeAppId: number | null;     // <-- delete this line
  signature: string;
  origin: string | null;
}): Promise<Raw<Message>> {
```

Delete the marked line. The body never uses `args.safeAppId`, so no other change is needed.

- [ ] **Step 3.3: Drop the hard-coded `safeAppId: null` from `mapQueueToMessage`**

In `src/modules/queue/mappers/message.mapper.ts`, the mapper currently sets `safeAppId: null` on the produced domain Message. Delete that line. The domain entity loses the field in Task 4, so the mapper output already needs to stop producing it.

- [ ] **Step 3.4: Type-check the workspace**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors related to queue/messages. (Other pre-existing errors in unrelated files are out of scope.)

- [ ] **Step 3.5: Commit**

```bash
git add src/modules/queue/queue.interface.ts \
        src/modules/queue/queue.service.ts \
        src/modules/queue/mappers/message.mapper.ts
git commit -m "refactor(queue): drop vestigial safeAppId from postMessage

The Safe Queue Service neither accepts nor returns safeAppId — the field
is gone from the spec end-to-end. Drop it from IQueue.postMessage, the
QueueService implementation, and mapQueueToMessage, where it was always
being silently set to null."
```

---

## Task 4: Drop `safeAppId` from the messages domain

The domain `Message` entity, its schema, and the `MessagesRepository.createMessage` argument list all carry a now-meaningless `safeAppId`. Remove it. The route-level controller still receives `safeAppId` from the client DTO (kept for backwards compatibility) but no longer threads it into the service.

**Files:**
- Modify: `src/modules/messages/domain/entities/message.entity.ts`
- Modify: `src/modules/messages/domain/entities/__tests__/message.builder.ts` (drop the default `.with('safeAppId', ...)`)
- Modify: `src/modules/messages/domain/entities/__tests__/message.entity.spec.ts` (if it asserts the field — check first)
- Modify: `src/modules/messages/domain/entities/message.entity.spec.ts` (sibling spec file — check both)
- Modify: `src/modules/messages/domain/messages.repository.interface.ts`
- Modify: `src/modules/messages/domain/messages.repository.ts`
- Modify: `src/modules/messages/routes/messages.service.ts`
- Modify: `src/modules/messages/routes/messages.controller.ts`

- [ ] **Step 4.1: Remove `safeAppId` from the domain `Message` schema/entity**

In `src/modules/messages/domain/entities/message.entity.ts`, delete the line:

```ts
safeAppId: NullableNumberSchema,
```

If the schema export uses `z.object({ ... }).strict()` the entity test fixtures may need updating. Inspect by running:

```bash
grep -n "safeAppId" src/modules/messages/domain/entities/__tests__/message.entity.spec.ts
```

If it appears, remove all `safeAppId` references from the test fixtures and assertions.

- [ ] **Step 4.2: Drop `safeAppId` from `IMessagesRepository.createMessage`**

In `src/modules/messages/domain/messages.repository.interface.ts`, the interface signature currently lists `safeAppId: number;` (or similar) as a parameter. Delete that line.

- [ ] **Step 4.3: Drop `safeAppId` from `MessagesRepository.createMessage`**

In `src/modules/messages/domain/messages.repository.ts`, the `createMessage` impl currently has `safeAppId: number | null;` on its args type and passes `safeAppId: args.safeAppId` to `IQueue.postMessage`. Delete both lines.

- [ ] **Step 4.4a: Drop the default `.with('safeAppId', ...)` from the message builder**

In `src/modules/messages/domain/entities/__tests__/message.builder.ts` find the line:

```ts
.with('safeAppId', faker.number.int())
```

(approximately line 80) and delete it. If any sibling builder spec references `safeAppId`, drop those references as well.

- [ ] **Step 4.4: Drop `safeAppId` from `MessagesService.createMessage`**

In `src/modules/messages/routes/messages.service.ts`, the inner call to `messagesRepository.createMessage` includes `safeAppId: args.createMessageDto.safeAppId,`. Delete that line. The args type for the service method doesn't itself name `safeAppId` (it accepts the whole `createMessageDto`), so no other change is needed there.

- [ ] **Step 4.5: Type-check + run unit suites**

```bash
npx tsc --noEmit -p tsconfig.json
yarn test:unit --watchman=false --testPathPattern='messages|queue'
```

Expected: type-check passes (for our files), unit suites green.

If tests reference `safeAppId` on a domain `Message` (e.g. inside `messages.controller.integration.spec.ts`'s fixtures), update the fixtures to not set the field. The route-level response shape isn't yet changed — that's Task 6.

- [ ] **Step 4.6: Commit**

```bash
git add src/modules/messages/domain/ src/modules/messages/routes/messages.service.ts
git commit -m "refactor(messages): drop safeAppId from domain layer

The queue service does not carry safeAppId, so the domain Message
entity, its schema, and MessagesRepository.createMessage no longer need
the field. The route-level CreateMessageDto still accepts safeAppId
from clients (unchanged wire shape) but the controller stops threading
it into the service."
```

---

## Task 5: Wire `SafeAppByOriginMapper` into `MessageMapper`

Replace the `safeAppsRepository.getSafeAppById(chainId, message.safeAppId)` call (which is now dead because the field was removed in Task 4) with a `safeAppByOrigin.findByOrigin(chainId, message.origin, ...)` call. Populate the existing `name` / `logoUri` in the response from the resolved SafeApp.

**Files:**
- Modify: `src/modules/messages/routes/mappers/message-mapper.ts`
- Modify: `src/modules/messages/routes/messages.controller.integration.spec.ts`

There is no dedicated `message-mapper.spec.ts`; the mapper's behaviour is exercised through the controller integration spec. Add cases there.

The integration spec has ~20 existing `.with('safeAppId', safeApps[N].id)` calls that wire a domain `Message` to a SafeApp via id. Once Task 4 removes `safeAppId` from the domain entity those `.with(...)` calls are TypeScript errors and need to be rewritten to use `origin` JSON instead.

- [ ] **Step 5.0: Rewrite the existing fixtures to use `origin` instead of `safeAppId`**

Locate every `.with('safeAppId', ...)` call in `src/modules/messages/routes/messages.controller.integration.spec.ts` and rewrite the surrounding test to:

- Replace `.with('safeAppId', safeApps[N].id)` with `.with('origin', JSON.stringify({ name: safeApps[N].name, url: safeApps[N].url }))`. The chain fixture already registers the SafeApp; the URL is what the new mapper looks up.
- Delete `.with('safeAppId', null)` calls (the field no longer exists; the default builder no longer sets it). Verify those tests still encode the "no SafeApp resolution" case some other way — typically `.with('origin', null)` or by leaving origin as the builder's default which produces an unresolvable URL.

The test "should return null name and logo if no safeAppId in the message" needs renaming and reframing — it now expresses "should return null name and logo if origin is null". Update its title and its `.with('safeAppId', null)` to `.with('origin', null)`.

After the rewrite, run `yarn test --watchman=false --testPathPattern='messages.controller.integration'` to confirm the **existing** tests still describe the same scenarios (will fail until Step 5.3 lands the mapper change — that's fine).

- [ ] **Step 5.1: Add a failing controller integration test for origin-URL lookup**

In `src/modules/messages/routes/messages.controller.integration.spec.ts`, search for existing tests that fetch a message and assert `name` / `logoUri`. Locate the block that mocks `safeAppsRepository.getSafeAppById` (or the equivalent test-config) and add a new test that asserts the origin-URL flow.

The exact insertion point depends on the spec's structure. The new test asserts:
- A message whose domain `origin` is `'{"name":"App","url":"https://app.example"}'`
- And whose chain has a registered SafeApp at `https://app.example`
- Returns a response with `name === 'App'`, `logoUri === <app-icon-url>`.

Pseudocode for the test (adapt to the spec's existing fixture builders):

```ts
it('resolves the SafeApp via origin URL', async () => {
  const chainId = chainBuilder().build().chainId;
  const safeApp = safeAppBuilder()
    .with('name', 'App')
    .with('url', 'https://app.example')
    .with('iconUrl', 'https://app.example/icon.png')
    .build();
  const domainMessage = messageBuilder()
    .with('origin', JSON.stringify({ name: 'App', url: 'https://app.example' }))
    .build();
  // Wire fixtures: chain returns the safeApp on getSafeApps({url: 'https://app.example'})
  // (the spec already has helpers for this; copy the pattern of an existing safe-app test)

  const response = await request(server)
    .get(`/v1/chains/${chainId}/messages/${domainMessage.messageHash}`)
    .expect(200);

  expect(response.body).toMatchObject({
    name: 'App',
    logoUri: 'https://app.example/icon.png',
  });
});
```

- [ ] **Step 5.2: Run the test — confirm it fails**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration' -t 'resolves the SafeApp via origin URL'`

Expected: FAIL — current mapper still uses `getSafeAppById`, which has nothing to look up because `message.safeAppId` was deleted in Task 4.

- [ ] **Step 5.3: Rewrite `MessageMapper` to use `SafeAppByOriginMapper`**

Replace the constructor and the body of `mapMessage` in `src/modules/messages/routes/mappers/message-mapper.ts`:

```ts
// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { MessageConfirmation as DomainMessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';
import { Message as DomainMessage } from '@/modules/messages/domain/entities/message.entity';
import { SafeAppByOriginMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { MessageConfirmation } from '@/modules/messages/routes/entities/message-confirmation.entity';
import { MessageItem } from '@/modules/messages/routes/entities/message-item.entity';
import {
  MessageStatus,
  Message,
} from '@/modules/messages/routes/entities/message.entity';

@Injectable()
export class MessageMapper {
  constructor(
    private readonly safeAppByOrigin: SafeAppByOriginMapper,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  async mapMessageItems(
    chainId: string,
    domainMessages: Array<DomainMessage>,
    safe: Safe,
  ): Promise<Array<MessageItem>> {
    return Promise.all(
      domainMessages.map(async (domainMessage) => {
        const message = await this.mapMessage(chainId, domainMessage, safe);
        return new MessageItem(
          message.messageHash,
          message.status,
          message.logoUri,
          message.name,
          message.message,
          message.creationTimestamp,
          message.modifiedTimestamp,
          message.confirmationsSubmitted,
          message.confirmationsRequired,
          message.proposedBy,
          message.confirmations,
          message.preparedSignature,
          message.origin,
        );
      }),
    );
  }

  async mapMessage(
    chainId: string,
    message: DomainMessage,
    safe: Safe,
  ): Promise<Message> {
    const safeApp = await this.safeAppByOrigin.findByOrigin(
      chainId,
      message.origin,
      `messageHash=${message.messageHash}`,
    );
    const status =
      message.confirmations.length >= safe.threshold
        ? MessageStatus.Confirmed
        : MessageStatus.NeedsConfirmation;
    const proposedBy = await this.addressInfoHelper.getOrDefault(
      chainId,
      message.proposedBy,
      ['CONTRACT'],
    );
    const confirmations = await this.mapConfirmations(
      chainId,
      message.confirmations,
    );
    const preparedSignature =
      message.preparedSignature && status === MessageStatus.Confirmed
        ? message.preparedSignature
        : null;

    return new Message(
      message.messageHash,
      status,
      safeApp?.iconUrl ?? null,
      safeApp?.name ?? null,
      message.message,
      message.created.getTime(),
      message.modified.getTime(),
      message.confirmations.length,
      safe.threshold,
      proposedBy,
      confirmations,
      preparedSignature,
      message.origin,
    );
  }

  private async mapConfirmations(
    chainId: string,
    confirmations: Array<DomainMessageConfirmation>,
  ): Promise<Array<MessageConfirmation>> {
    return Promise.all(
      confirmations.map(async (confirmation) => {
        const owner = await this.addressInfoHelper.getOrDefault(
          chainId,
          confirmation.owner,
          ['CONTRACT'],
        );
        return new MessageConfirmation(owner, confirmation.signature);
      }),
    );
  }
}
```

The route entity constructor signature is **unchanged** in this task — `safeAppInfo` and the new deprecated `safeAppId` are added in Task 6.

- [ ] **Step 5.4: Run the test — confirm it passes**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration' -t 'resolves the SafeApp via origin URL'`

Expected: PASS.

- [ ] **Step 5.5: Run the full messages integration spec**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration'`

Expected: green. Failures here usually mean an existing test was set up against `safeAppsRepository.getSafeAppById`. Adapt those tests to mock the SafeApp lookup via `safeAppByOrigin` (or the lower-level `safeAppsRepository.getSafeApps` if the spec wires that directly).

- [ ] **Step 5.6: Lint, format**

```bash
yarn lint
yarn format
```

- [ ] **Step 5.7: Commit**

```bash
git add src/modules/messages/routes/mappers/message-mapper.ts \
        src/modules/messages/routes/messages.controller.integration.spec.ts
git commit -m "refactor(messages): resolve SafeApp via origin URL in MessageMapper

Mirror the transactions flow: parse the message's origin JSON, look up
the SafeApp by URL, and surface the same name/logoUri the route already
exposes. Domain message.safeAppId was removed in the previous commit so
this is the natural next step."
```

---

## Task 6: Surface `safeAppInfo` and (deprecated) `safeAppId` on the route entities

Add the `safeAppInfo` object and the deprecated `safeAppId` field to both `Message` and `MessageItem`. Mark the existing flat `name` / `logoUri` deprecated. Populate them from the SafeApp resolved in Task 5.

**Files:**
- Modify: `src/modules/messages/routes/entities/message.entity.ts`
- Modify: `src/modules/messages/routes/entities/message-item.entity.ts`
- Modify: `src/modules/messages/routes/mappers/message-mapper.ts`
- Modify: `src/modules/messages/routes/messages.controller.integration.spec.ts`

- [ ] **Step 6.1: Add a failing test for the new response fields**

Add a new case (or extend the test from Step 5.1) in `messages.controller.integration.spec.ts`:

```ts
it('exposes safeAppInfo and a populated deprecated safeAppId on the response', async () => {
  // Same fixture wiring as Step 5.1 — message with origin JSON + chain
  // with a registered SafeApp at the same URL.
  // Pre-condition: the SafeApp's id is known (e.g. `safeApp.id === 24`).

  const response = await request(server)
    .get(`/v1/chains/${chainId}/messages/${domainMessage.messageHash}`)
    .expect(200);

  expect(response.body).toMatchObject({
    safeAppInfo: {
      name: 'App',
      url: 'https://app.example',
      logoUri: 'https://app.example/icon.png',
    },
    safeAppId: safeApp.id,
    name: 'App',         // legacy, still populated
    logoUri: 'https://app.example/icon.png', // legacy, still populated
  });
});
```

- [ ] **Step 6.2: Run the test — confirm it fails**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration' -t 'exposes safeAppInfo'`

Expected: FAIL — `safeAppInfo` undefined on the response, `safeAppId` undefined too.

- [ ] **Step 6.3: Update `Message` route entity**

Replace `src/modules/messages/routes/entities/message.entity.ts` so the class has the new fields and constructor arguments. The full updated file:

```ts
// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MessageConfirmation } from '@/modules/messages/routes/entities/message-confirmation.entity';
import { TypedData } from '@/modules/messages/routes/entities/typed-data.entity';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';
import type { Hash, Hex } from 'viem';

export enum MessageStatus {
  NeedsConfirmation = 'NEEDS_CONFIRMATION',
  Confirmed = 'CONFIRMED',
}

@ApiExtraModels(TypedData)
export class Message {
  @ApiProperty()
  messageHash: Hash;
  @ApiProperty({ enum: MessageStatus })
  status: MessageStatus;

  /** @deprecated Read `safeAppInfo.logoUri` instead. */
  @ApiPropertyOptional({ type: String, nullable: true, deprecated: true })
  logoUri: string | null;

  /** @deprecated Read `safeAppInfo.name` instead. */
  @ApiPropertyOptional({ type: String, nullable: true, deprecated: true })
  name: string | null;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { $ref: getSchemaPath(TypedData) }],
  })
  message: string | TypedData;
  @ApiProperty()
  creationTimestamp: number;
  @ApiProperty()
  modifiedTimestamp: number;
  @ApiProperty()
  confirmationsSubmitted: number;
  @ApiProperty()
  confirmationsRequired: number;
  @ApiProperty()
  proposedBy: AddressInfo;
  @ApiProperty({ type: MessageConfirmation, isArray: true })
  confirmations: Array<MessageConfirmation>;
  @ApiPropertyOptional({ type: String, nullable: true })
  preparedSignature: Hex | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  origin: string | null;

  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo: SafeAppInfo | null;

  /**
   * @deprecated Read `safeAppInfo` instead. Populated from the resolved
   * SafeApp's `id` for backwards compatibility while clients migrate.
   */
  @ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
  safeAppId: number | null;

  constructor(
    messageHash: Hash,
    status: MessageStatus,
    logoUri: string | null,
    name: string | null,
    message: string | TypedData,
    creationTimestamp: number,
    modifiedTimestamp: number,
    confirmationsSubmitted: number,
    confirmationsRequired: number,
    proposedBy: AddressInfo,
    confirmations: Array<MessageConfirmation>,
    preparedSignature: Hex | null,
    origin: string | null,
    safeAppInfo: SafeAppInfo | null,
    safeAppId: number | null,
  ) {
    this.messageHash = messageHash;
    this.status = status;
    this.logoUri = logoUri;
    this.name = name;
    this.message = message;
    this.creationTimestamp = creationTimestamp;
    this.modifiedTimestamp = modifiedTimestamp;
    this.confirmationsSubmitted = confirmationsSubmitted;
    this.confirmationsRequired = confirmationsRequired;
    this.proposedBy = proposedBy;
    this.confirmations = confirmations;
    this.preparedSignature = preparedSignature;
    this.origin = origin;
    this.safeAppInfo = safeAppInfo;
    this.safeAppId = safeAppId;
  }
}
```

- [ ] **Step 6.4: Update `MessageItem` route entity**

`message-item.entity.ts` extends `Message` semantically (similar field set). Repeat the same changes: add `safeAppInfo` and deprecated `safeAppId`, mark `name` / `logoUri` deprecated, append the two new constructor arguments. Open the existing file first to see its exact field order, then mirror the diff from Step 6.3 (don't reorder existing constructor args; append the two new ones at the end).

- [ ] **Step 6.5: Update `MessageMapper.mapMessage` to populate the new fields**

In `src/modules/messages/routes/mappers/message-mapper.ts`:

```ts
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';
```

Replace the `return new Message(...)` block at the end of `mapMessage` with:

```ts
const safeAppInfo = safeApp
  ? new SafeAppInfo(
      safeApp.name,
      safeApp.url.replace('ipfs.io', 'cloudflare-ipfs.com'),
      safeApp.iconUrl,
    )
  : null;

return new Message(
  message.messageHash,
  status,
  safeApp?.iconUrl ?? null,
  safeApp?.name ?? null,
  message.message,
  message.created.getTime(),
  message.modified.getTime(),
  message.confirmations.length,
  safe.threshold,
  proposedBy,
  confirmations,
  preparedSignature,
  message.origin,
  safeAppInfo,
  safeApp?.id ?? null,
);
```

Replace the `return new MessageItem(...)` block in `mapMessageItems` similarly:

```ts
return new MessageItem(
  message.messageHash,
  message.status,
  message.logoUri,
  message.name,
  message.message,
  message.creationTimestamp,
  message.modifiedTimestamp,
  message.confirmationsSubmitted,
  message.confirmationsRequired,
  message.proposedBy,
  message.confirmations,
  message.preparedSignature,
  message.origin,
  message.safeAppInfo,
  message.safeAppId,
);
```

(Both new fields just propagate from the already-populated `Message`.)

- [ ] **Step 6.6: Run the failing test — confirm it passes**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration' -t 'exposes safeAppInfo'`

Expected: PASS.

- [ ] **Step 6.7: Run the full messages integration spec**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration'`

Expected: green.

- [ ] **Step 6.8: Lint, format**

```bash
yarn lint
yarn format
```

- [ ] **Step 6.9: Commit**

```bash
git add src/modules/messages/routes/entities/ src/modules/messages/routes/mappers/
git commit -m "feat(messages): expose safeAppInfo on response, deprecate safeAppId/name/logoUri

Mirror the transactions response shape: messages now include a
safeAppInfo object resolved from the origin URL. The legacy flat
name/logoUri and the top-level safeAppId remain for backwards
compatibility, marked @deprecated in the OpenAPI schema. safeAppId is
populated from the resolved SafeApp's id so legacy clients keep working
while they migrate."
```

---

## Task 7: Mark `CreateMessageDto.safeAppId` as `@deprecated`

The DTO already exposes `safeAppId: number | null`. The server now ignores the value, but we keep accepting it on the wire. Add a deprecation hint so OpenAPI/Swagger documents the migration path.

**Files:**
- Modify: `src/modules/messages/routes/entities/create-message.dto.entity.ts`

- [ ] **Step 7.1: Mark the field deprecated in OpenAPI**

In `src/modules/messages/routes/entities/create-message.dto.entity.ts`, locate:

```ts
@ApiPropertyOptional({ type: Number, nullable: true })
safeAppId!: number | null;
```

Replace with:

```ts
/**
 * @deprecated Send the SafeApp identity inside the `origin` JSON field
 * (`{name, url}`). The server now resolves the SafeApp by URL; this
 * value is accepted for backwards compatibility but ignored.
 */
@ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
safeAppId!: number | null;
```

If a sibling `create-message.dto.schema.ts` exists (zod schema for the DTO), it does not need changes — `safeAppId` continues to validate as `number().int().gte(0).nullish().default(null)`. Confirm by inspecting the file.

- [ ] **Step 7.2: Re-run the messages integration spec to confirm wire-level acceptance still works**

Run: `yarn test --watchman=false --testPathPattern='messages.controller.integration|create-message.dto.schema'`

Expected: green.

- [ ] **Step 7.3: Lint, format**

```bash
yarn lint
yarn format
```

- [ ] **Step 7.4: Commit**

```bash
git add src/modules/messages/routes/entities/create-message.dto.entity.ts
git commit -m "docs(messages): mark CreateMessageDto.safeAppId as @deprecated"
```

---

## Task 8: Final verification

- [ ] **Step 8.1: Run the full unit suite**

Run: `yarn test:unit --watchman=false`

Expected: 0 failing suites, 0 failing tests.

- [ ] **Step 8.2: Run lint, format, env:validate**

```bash
yarn lint
yarn format
yarn env:validate
```

Expected: no errors. `env:validate` may print warnings about pre-existing extras — only block on errors.

- [ ] **Step 8.3: Type-check the workspace**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: no errors in files touched by this plan. Pre-existing errors in unrelated files (tracked under their own follow-ups) are out of scope.

- [ ] **Step 8.4: Push the branch**

```bash
git push
```

- [ ] **Step 8.5: Confirm CI is green on the PR**

Visit the PR on GitHub. Confirm `prettier`, `es-lint`, `env-validation`, `unit-tests`, `integration-tests`, and `license-headers` all pass.
