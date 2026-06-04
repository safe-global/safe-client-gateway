<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Message SafeApp resolution by origin URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the message's SafeApp from `origin` (URL-based) the same way transactions do today, drop the now-vestigial `safeAppId` plumbing, and surface `safeAppInfo` on the response with a deprecated top-level `safeAppId` mirror for legacy clients.

**Architecture:** Move the existing `SafeAppInfoMapper` into `src/modules/safe-apps/mappers/` so both transactions and messages can consume it. Add `id: number` to the route `SafeAppInfo` so the mapper output is self-sufficient. Messages mirror `safeAppInfo.id` into a deprecated top-level `safeAppId` inside the messages module.

**Tech Stack:** TypeScript, NestJS, Jest, zod schemas.

**Spec:** `docs/superpowers/specs/2026-05-04-message-safe-app-info-by-origin-design.md`

---

## File Structure

**Moved (path only):**

- `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts` → `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`
- `…/safe-app-info.mapper.spec.ts` → `…/safe-apps/mappers/safe-app-info.mapper.spec.ts`

**Modified:**

- The moved mapper: signature becomes `mapSafeAppInfo(chainId, origin, safeTxHash)`. The transaction parameter is replaced by direct `origin` + `safeTxHash` (used only for log decoration) args. `getOriginUrl` is rewritten to consume `parseOrigin` from `@/modules/queue/helpers/origin.helper.ts`. Existing log lines and the IPFS/CF-IPFS rewrite stay.
- `src/modules/queue/helpers/origin.helper.ts` — fix typo so `parseOrigin` actually populates `originUrl` (today the helper assigns the URL onto `originName`, leaving `originUrl` undefined).
- `src/modules/transactions/routes/entities/safe-app-info.entity.ts` — add `id: number`.
- `src/modules/safe-apps/safe-apps.module.ts` — provide + export `SafeAppInfoMapper`.
- `src/modules/transactions/transactions.module.ts` — drop redundant local provider.
- Three transaction consumers (`multisig-transaction.mapper.ts`, `multisig-transaction-details.mapper.ts`, `human-description.mapper.ts`) — import-path change, pass `transaction.origin, transaction.safeTxHash` instead of `transaction`.
- `src/modules/queue/queue.interface.ts`, `queue.service.ts`, `mappers/message.mapper.ts` — drop the dead `safeAppId` arg/field.
- `src/modules/messages/domain/entities/message.entity.ts`, `__tests__/message.builder.ts`, `messages.repository.interface.ts`, `messages.repository.ts`, `routes/messages.service.ts` — drop the dead `safeAppId`.
- `src/modules/messages/routes/entities/message.entity.ts`, `message-item.entity.ts` — add `safeAppInfo`, deprecated `safeAppId`; mark `name`/`logoUri` deprecated.
- `src/modules/messages/routes/mappers/message-mapper.ts` — call shared mapper, mirror `safeAppInfo.id`/`name`/`logoUri` into the response.
- `src/modules/messages/routes/entities/create-message.dto.entity.ts` — mark `safeAppId` `@deprecated` in OpenAPI.
- `src/modules/messages/routes/messages.controller.integration.spec.ts` — rewrite `.with('safeAppId', …)` fixtures to use `origin`; assert new response shape.

---

## Task 1: Move mapper, add `id` to `SafeAppInfo`, update transaction consumers

**Files:** see "File structure" above; this task touches the `safe-apps`, `transactions`, and shared-module pieces.

- [ ] **Step 1.1: Move via `git mv`**

```bash
mkdir -p src/modules/safe-apps/mappers
git mv src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts \
       src/modules/safe-apps/mappers/safe-app-info.mapper.ts
git mv src/modules/transactions/routes/mappers/common/safe-app-info.mapper.spec.ts \
       src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts
```

- [ ] **Step 1.2: Add `id` to `SafeAppInfo`**

`src/modules/transactions/routes/entities/safe-app-info.entity.ts`:

```ts
export class SafeAppInfo {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  url: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;

  constructor(id: number, name: string, url: string, logoUri: string | null) {
    this.id = id;
    this.name = name;
    this.url = url;
    this.logoUri = logoUri;
  }
}
```

- [ ] **Step 1.3: Fix `parseOrigin` typo, then adapt the mapper to consume it**

First, fix `src/modules/queue/helpers/origin.helper.ts` — the line `parsedOrigin.originName = url;` (line 25) must be `parsedOrigin.originUrl = url;`. The helper currently overwrites `originName` with the URL and leaves `originUrl` undefined; nothing depends on it today, but the mapper will. No other change to the helper.

Then, in `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`:

- Change the signature to `mapSafeAppInfo(chainId: string, origin: string | null, safeTxHash: string)` — both `origin` and `safeTxHash` are passed by the caller, no `MultisigTransaction` parameter, no other rewrites.
- Rewrite the private helper to `getOriginUrl(origin: string | null, safeTxHash: string): string | null` and have it call `parseOrigin(origin)` from `@/modules/queue/helpers/origin.helper.ts` and return its `originUrl ?? null`. Keep the existing debug log when an origin is present but no URL comes back, interpolating `safeTxHash` and the raw `origin` as today.
- Keep the existing `safeTxHash` interpolation in the "no Safe App matched" info log.
- In the success branch, build `new SafeAppInfo(safeApp.id, safeApp.name, safeApp.url.replace(IPFS, CF_IPFS), safeApp.iconUrl)` so the new `id` field is populated.

- [ ] **Step 1.4: Adapt the moved spec to the new signature**

In `src/modules/safe-apps/mappers/safe-app-info.mapper.spec.ts`:

- Replace `multisigTransactionBuilder()` fixtures with two literal call args: an `origin` string (`JSON.stringify({ name, url })` or `null`) and a `safeTxHash` (any hex string from `faker`). Calls become `mapper.mapSafeAppInfo(chainId, origin, safeTxHash)`.
- Drop the now-unused `multisigTransactionBuilder` import.
- Keep the existing `safeTxHash` log assertions; the value now comes from the test arg instead of `transaction.safeTxHash`, but the assertions still apply.
- In the match-success test, assert the returned `SafeAppInfo` includes `id`, sourced from the `SafeApp` fixture.

- [ ] **Step 1.5: Wire up DI**

- `src/modules/safe-apps/safe-apps.module.ts`: add `SafeAppInfoMapper` to `providers` and `exports`; import it from `@/modules/safe-apps/mappers/safe-app-info.mapper`.
- `src/modules/transactions/transactions.module.ts`: remove the local `SafeAppInfoMapper` import and its entry in `providers` (`SafeAppsModule` is already in `imports`).

- [ ] **Step 1.6: Update the three transaction consumers**

In each of:

- `src/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper.ts`
- `…/multisig-transactions/multisig-transaction-details.mapper.ts`
- `…/common/human-description.mapper.ts`

change the import path to `@/modules/safe-apps/mappers/safe-app-info.mapper` and update the call site from `mapSafeAppInfo(chainId, transaction)` to `mapSafeAppInfo(chainId, transaction.origin, transaction.safeTxHash)`. No other change.

- [ ] **Step 1.7: Run + commit**

```bash
yarn test:unit --watchman=false --testPathPattern='safe-app|multisig-transaction|human-descriptions|origin.helper'
yarn lint && yarn format && yarn env:validate
git add src/modules/safe-apps/ src/modules/transactions/ src/modules/queue/helpers/origin.helper.ts
git commit -m "refactor: move SafeAppInfoMapper to safe-apps, add id to SafeAppInfo

The mapper now lives in safe-apps so messages can consume it. Signature
takes (chainId, origin, safeTxHash) instead of a MultisigTransaction;
getOriginUrl now uses parseOrigin from queue/helpers/origin.helper.ts
(typo fix included so it actually returns the URL). SafeAppInfo gains an
additive id: number field populated from SafeApp.id."
```

---

## Task 2: Drop dead `safeAppId` from queue + messages domain

The queue spec doesn't carry `safeAppId`, and the messages domain shouldn't either.

- [ ] **Step 2.1: Drop the field from queue**

- `src/modules/queue/queue.interface.ts`: remove `safeAppId: number | null;` from `postMessage`.
- `src/modules/queue/queue.service.ts`: remove the same line from the `postMessage` args type. The body never references it.
- `src/modules/queue/mappers/message.mapper.ts`: remove the `safeAppId: null` line that fabricates a domain field.

- [ ] **Step 2.2: Drop the field from messages domain + write path**

- `src/modules/messages/domain/entities/message.entity.ts`: remove `safeAppId: NullableNumberSchema,` from the schema.
- `src/modules/messages/domain/entities/__tests__/message.builder.ts`: remove the default `.with('safeAppId', faker.number.int())` call.
- `src/modules/messages/domain/messages.repository.interface.ts`: remove `safeAppId: number;` from `createMessage`.
- `src/modules/messages/domain/messages.repository.ts`: remove the `safeAppId` arg field and the `safeAppId: args.safeAppId` line forwarded to `IQueue.postMessage`.
- `src/modules/messages/routes/messages.service.ts`: remove `safeAppId: args.createMessageDto.safeAppId,` from the inner `messagesRepository.createMessage` call.

- [ ] **Step 2.3: Type-check + commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/modules/queue/ src/modules/messages/domain/ src/modules/messages/routes/messages.service.ts
git commit -m "refactor: drop vestigial safeAppId from queue + messages domain

Neither the queue spec nor the messages domain need it; the route DTO
still accepts the deprecated field but the controller no longer threads
it onward. Surfacing app info on the response moves to Task 3."
```

Failing integration tests are expected here — they're rewritten in Task 3.

---

## Task 3: Wire shared mapper into messages, surface `safeAppInfo`

- [ ] **Step 3.1: Add `safeAppInfo` and deprecated `safeAppId` to the route entities**

In `src/modules/messages/routes/entities/message.entity.ts` and `message-item.entity.ts`:

- Add `import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';`.
- Add `@ApiPropertyOptional({ type: SafeAppInfo, nullable: true }) safeAppInfo: SafeAppInfo | null;`.
- Add `@ApiPropertyOptional({ type: Number, nullable: true, deprecated: true }) safeAppId: number | null;` with a `@deprecated` JSDoc pointing at `safeAppInfo`.
- Mark the existing `name` and `logoUri` `deprecated: true` and add `@deprecated` JSDoc on each.
- Append `safeAppInfo` and `safeAppId` to the constructor parameter list (don't reorder existing params) and assign them.

- [ ] **Step 3.2: Rewrite `MessageMapper`**

Replace the body of `mapMessage` in `src/modules/messages/routes/mappers/message-mapper.ts` so it:

1. Replaces the `safeAppsRepository.getSafeAppById` call with `safeAppInfo = await this.safeAppInfoMapper.mapSafeAppInfo(chainId, message.origin, message.messageHash)`. Note: messages don't carry a `safeTxHash`; we pass `messageHash` as the hash arg the mapper uses for log decoration.
2. Returns a `Message` constructed with the existing args plus `safeAppInfo` and `safeAppInfo?.id ?? null`. The deprecated top-level `name`/`logoUri` continue to mirror `safeAppInfo?.name`/`safeAppInfo?.logoUri`.

Update `mapMessageItems` to forward `message.safeAppInfo` and `message.safeAppId` to the `MessageItem` constructor.

Constructor field rename: `safeAppsRepository` → `safeAppInfoMapper: SafeAppInfoMapper`. Drop the `ISafeAppsRepository` import; add `import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';`.

`MessagesModule` already imports `SafeAppsModule`, so DI works without further wiring.

- [ ] **Step 3.3: Rewrite the integration-spec fixtures**

In `src/modules/messages/routes/messages.controller.integration.spec.ts`:

- For every `.with('safeAppId', safeApps[N].id)`, replace with `.with('origin', JSON.stringify({ name: safeApps[N].name, url: safeApps[N].url }))`. The chain fixture already registers `safeApps`; the URL is what the mapper looks up.
- Remove all `.with('safeAppId', null)` (the field no longer exists). Where the test was asserting "no SafeApp resolution", set `.with('origin', null)` instead, or leave the builder default if it produces an unresolvable URL.
- Rename the test "should return null name and logo if no safeAppId in the message" to "…if origin is null"; update its `.with('safeAppId', null)` to `.with('origin', null)`.
- Add one new test that asserts the new response shape on a resolved SafeApp:

```ts
expect(response.body).toMatchObject({
  safeAppInfo: {
    id: safeApp.id,
    name: safeApp.name,
    url: safeApp.url,
    logoUri: safeApp.iconUrl,
  },
  safeAppId: safeApp.id,
  name: safeApp.name,
  logoUri: safeApp.iconUrl,
});
```

- [ ] **Step 3.4: Run + commit**

```bash
yarn test:unit --watchman=false --testPathPattern='messages'
yarn lint && yarn format
git add src/modules/messages/
git commit -m "feat(messages): resolve SafeApp via origin URL, expose safeAppInfo

MessageMapper now delegates to the shared SafeAppInfoMapper. The
response gains a safeAppInfo object; the deprecated top-level safeAppId
mirrors safeAppInfo.id, and name/logoUri continue to mirror their
SafeAppInfo counterparts so legacy clients keep working."
```

---

## Task 4: Mark `CreateMessageDto.safeAppId` `@deprecated`

- [ ] **Step 4.1: Add the deprecation hint**

In `src/modules/messages/routes/entities/create-message.dto.entity.ts`, change:

```ts
@ApiPropertyOptional({ type: Number, nullable: true })
safeAppId!: number | null;
```

to:

```ts
/** @deprecated Send the SafeApp identity inside `origin` ({ name, url }). The server resolves it by URL; this value is accepted for backwards compatibility but ignored. */
@ApiPropertyOptional({ type: Number, nullable: true, deprecated: true })
safeAppId!: number | null;
```

- [ ] **Step 4.2: Run + commit**

```bash
yarn test:unit --watchman=false --testPathPattern='messages'
git add src/modules/messages/routes/entities/create-message.dto.entity.ts
git commit -m "docs(messages): mark CreateMessageDto.safeAppId @deprecated"
```

---

## Task 5: Final verification

- [ ] **Step 5.1: Full sweep**

```bash
yarn test:unit --watchman=false
yarn lint && yarn format && yarn env:validate
npx tsc --noEmit -p tsconfig.json
git push
```

All green; CI passes on the PR.
