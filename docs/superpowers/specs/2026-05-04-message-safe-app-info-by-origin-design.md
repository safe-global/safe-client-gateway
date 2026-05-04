<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Message SafeApp resolution by origin URL

Date: 2026-05-04
Status: Draft

## Background

The Client Gateway exposes two write paths that surface a "Safe App" on the
read side: transactions and messages. Today these flows resolve the SafeApp
differently:

- **Transactions** ship the SafeApp identity inside the JSON `origin` string
  (`{name, url, note?}`). On read, `SafeAppInfoMapper` parses the origin,
  looks up the SafeApp by URL, and returns a `SafeAppInfo` object
  (`{name, url, logoUri}`) on the response.
- **Messages** ship a separate `safeAppId: number | null` field on the
  request and persist it on the upstream service. On read, `MessageMapper`
  looks up the SafeApp by id and surfaces the `name` / `logoUri` flat on
  the response.

Recent migration work moved message writes/reads onto the Safe Queue Service.
The queue's spec does not carry `safeAppId` end-to-end: the queue accepts
`originName` / `originUrl` on write and returns them on read. Our
`mapQueueToMessage` already sets `safeAppId: null` because the queue cannot
supply it. As a result, messages from the queue currently surface no app
info to clients — the `MessageMapper` is asking for a SafeApp by an id that
is always `null`.

## Goal

Resolve the SafeApp on messages the same way transactions do: by parsing
`origin` and looking up the SafeApp by URL. Surface the result on the
message response in a shape that mirrors the transaction response
(a nested `safeAppInfo` object) and, transitionally, populate the existing
flat fields and a top-level `safeAppId` so that legacy clients keep working
while migrating to the new shape.

## Non-goals

- Backfilling historical messages whose `safeAppId` was previously written
  to the upstream service. There is no historical state to migrate: the
  queue never stored `safeAppId` and the field is already null on every
  message read through the queue.
- Removing the `safeAppId` field from the public request DTO or response.
  Both stay, marked deprecated, until clients have migrated.
- Changing the transaction response shape. Transactions already use
  `safeAppInfo`; this spec only realigns messages and extracts the shared
  lookup.

## Approach

1. **Move `SafeAppInfoMapper` to a shared home, no rename.** Move from
   `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts`
   to `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`. The new
   home is the module that owns the `SafeApp` domain entity, so both the
   transactions and messages routes module depend on it without forming a
   transactions → messages or messages → transactions cross-dependency.
   The class keeps the name `SafeAppInfoMapper`.

2. **Pass `origin` and `safeTxHash` directly.** The current method takes a
   `MultisigTransaction` so it can pull `origin` and `safeTxHash` (the
   latter only for log decoration). Replace with
   `mapSafeAppInfo(chainId: string, origin: string | null, safeTxHash: string) → SafeAppInfo | null`.
   The hash arg is kept for log lines — messages don't have a `safeTxHash`
   so they pass `messageHash` into the same parameter; the mapper treats
   it as opaque log context. Origin parsing is delegated to the existing
   `parseOrigin` helper at `src/modules/queue/helpers/origin.helper.ts`
   (a one-character typo in that helper — `originName = url` instead of
   `originUrl = url` — is fixed as a prerequisite). The mapper continues
   to build the route `SafeAppInfo` internally; the IPFS→Cloudflare URL
   replacement stays inside the mapper, so call sites never reach into a
   domain `SafeApp`.

3. **Add `id` to `SafeAppInfo`.** The `SafeAppInfo` route entity gains a
   single new field `id: number`, populated from the resolved
   `SafeApp.id`. This is what allows the messages flow to populate its
   deprecated top-level `safeAppId` from the same mapper call, without
   forcing a second lookup or a tuple return type. For transactions the
   change is purely additive: `safeAppInfo.id` appears as a new field
   on the existing nested object; existing clients ignore it.

4. **Drop `safeAppId` from the message domain.** The field is removed from
   the `Message` domain entity, its schema, and from
   `IMessagesRepository.createMessage`, `MessagesRepository.createMessage`,
   `IQueue.postMessage`, and `mapQueueToMessage`. The queue layer wasn't
   sending or receiving it; this is a pure cleanup of a vestigial parameter.

5. **Keep the public `safeAppId` deprecated, not removed.**
   - `CreateMessageDto.safeAppId` stays as a wire-level field, marked
     `@deprecated` in the OpenAPI schema. The controller reads it and
     discards it; the service is no longer parameterized by it.
   - The response `Message` and `MessageItem` entities gain
     `safeAppId: number | null` (also marked `@deprecated`), populated
     from `safeAppInfo?.id ?? null`, so clients that haven't switched to
     reading `safeAppInfo` see the same value they always saw. The legacy
     flat `name` / `logoUri` likewise remain and are marked deprecated.

## Public API surface

### Request

`POST /v1/chains/:chainId/messages/raw/:safeAddress` (unchanged path,
unchanged controller).

Request body (no wire change):

```json
{
  "message": "...",
  "signature": "0x...",
  "safeAppId": 24, // deprecated, accepted but ignored server-side
  "origin": "{\"name\":\"...\",\"url\":\"https://app.example\"}"
}
```

### Response

`Message` and `MessageItem` gain two new fields and mark three existing
ones as deprecated. `SafeAppInfo` itself gains an `id` field for both
transactions and messages.

```json
{
  // ...existing fields...

  "safeAppInfo": {
    "id": 24,
    "name": "App",
    "url": "https://app.example",
    "logoUri": "https://..."
  },

  "safeAppId": 24, // deprecated; mirrors safeAppInfo.id
  "name": "App", // deprecated; mirrors safeAppInfo.name
  "logoUri": "https://..." // deprecated; mirrors safeAppInfo.logoUri
}
```

When the message's `origin` is `null`, invalid JSON, or matches no listed
SafeApp, all four (`safeAppInfo`, `safeAppId`, `name`, `logoUri`) are
`null` together.

The transactions response is unchanged in shape except for the additive
`safeAppInfo.id` field on the existing nested object.

## Components

```
src/
  modules/
    safe-apps/
      domain/
        entities/safe-app.entity.ts       (existing)
      mappers/
        safe-app-info.mapper.ts            (moved from transactions/.../common/,
                                            class name unchanged)
        safe-app-info.mapper.spec.ts       (moved spec, signature reshaped)

    messages/
      domain/
        entities/message.entity.ts         (drop safeAppId field)
      messages.repository.ts                (drop safeAppId arg)
      messages.repository.interface.ts      (drop safeAppId arg)
      routes/
        entities/
          message.entity.ts                 (add safeAppInfo, deprecated safeAppId)
          message-item.entity.ts            (add safeAppInfo, deprecated safeAppId)
          safe-app-info.entity.ts           (add `id: number` field — shared with txs)
        mappers/
          message-mapper.ts                 (call mapper, mirror id into
                                             deprecated top-level safeAppId)
        messages.service.ts                 (drop safeAppId arg)

    queue/
      queue.interface.ts                    (drop safeAppId arg from postMessage)
      queue.service.ts                      (drop safeAppId arg)
      mappers/message.mapper.ts             (drop the `safeAppId: null`
                                             output line)
      helpers/origin.helper.ts              (fix `parseOrigin` typo so it
                                             actually returns `originUrl`)

    transactions/
      routes/entities/safe-app-info.entity.ts (add `id: number` field)
      routes/mappers/common/                (delete safe-app-info.mapper.*)
      routes/mappers/                       (every consumer of the old mapper
                                             updates the import path; no other
                                             change — mapper still returns
                                             SafeAppInfo, just with `.id`)
```

## Data flow (read path)

```
1. Controller hits MessagesService.getMessage(chainId, hash)
2. Service asks MessagesRepository → returns domain Message
   (no safeAppId field anymore; origin is JSON string)
3. MessageMapper.mapMessage:
     a. safeAppInfo = await safeAppInfoMapper.mapSafeAppInfo(
          chainId, message.origin, message.messageHash)
        // SafeAppInfo | null = { id, name, url, logoUri }
        // messageHash is passed as the mapper's `safeTxHash` log-context arg
     b. safeAppId = safeAppInfo?.id ?? null   // deprecated top-level mirror
     c. name = safeAppInfo?.name ?? null      // deprecated top-level mirror
     d. logoUri = safeAppInfo?.logoUri ?? null // deprecated top-level mirror
4. Response Message returned with safeAppInfo + the three deprecated mirrors
```

`MessageItem` follows the same flow per entry.

## Data flow (write path)

```
1. Controller receives CreateMessageDto { message, signature, safeAppId, origin }
2. Controller calls MessagesService.createMessage({ message, signature, origin, ... })
   — safeAppId is read off the DTO but not threaded onward.
3. MessagesRepository.createMessage forwards to IQueue.postMessage
   (no safeAppId arg).
4. Queue request body: { chainId, message, signatures, originName, originUrl }.
```

## Error handling

`SafeAppInfoMapper.mapSafeAppInfo` keeps the existing transaction-side
behaviour, lifted to operate on a plain origin string:

- `origin = null` → returns `null`, no log.
- `origin` not parseable as JSON, or parses but has no `url` field →
  `parseOrigin` returns `originUrl: undefined`; the mapper logs a debug
  line interpolating the hash arg and the raw `origin`, returns `null`.
- `origin.url` matches no listed SafeApp → returns `null`, info log
  including the URL and the hash arg.
- Match found → returns a `SafeAppInfo` with `id`, `name`, `url`
  (IPFS→Cloudflare-rewritten), and `logoUri` set.

Consumers project `null → null`, so message responses degrade gracefully
when the origin can't be resolved.

## Testing

- `safe-app-info.mapper.spec.ts` (moved): retain coverage for null origin,
  origin without URL, no-match, and match cases. Fixtures are plain
  `(origin, safeTxHash)` argument pairs (no `MultisigTransaction` builder).
  The match case asserts the returned `SafeAppInfo` carries `id`, `name`,
  `url`, and `logoUri`. Log-line assertions retain the `safeTxHash`
  interpolation.
- `messages.controller` integration spec covers the messages mapper
  end-to-end (there is no dedicated `message-mapper.spec.ts`). On this
  branch the queue service is enabled in test config, so the spec is
  rewired to mock the queue-service URLs (`${queueBaseUri}/api/v1/...`)
  alongside the existing TX-service mocks, and a small helper converts a
  domain `Message` fixture to the `QueueMessage` JSON shape (separate
  `originName` / `originUrl` fields, `chainId` included). The default
  `messageBuilder` origin is also tightened from `fakeJson()` to
  `JSON.stringify({ name, url })` so the queue→message round trip is
  identity. Tests cover:
  - Origin matches a listed SafeApp → response contains `safeAppInfo`
    (`{ id, name, url, logoUri }`), the deprecated mirrors `safeAppId`,
    `name`, `logoUri`, and the original `origin` JSON string.
  - Origin is null, origin has no URL, or origin matches no listed
    SafeApp → all four fields are `null`.
  - `CreateMessageDto.safeAppId` is still accepted on the wire but no
    longer threads onward (legacy TX path passes `null`).
- Existing transaction mapper specs: re-run after the import-path change
  to confirm tests still pass; no behavioural change expected.

Acceptance: `yarn test:unit --testPathPattern='message|safe-app|multisig-transaction.mapper|origin.helper'`
and `yarn test:integration --testPathPattern='messages.controller'` both
green, plus `yarn lint`, `yarn format`, `yarn env:validate` clean.

## Deprecation timeline

- This change introduces deprecation marks on `CreateMessageDto.safeAppId`,
  `Message.safeAppId`, `MessageItem.safeAppId`, `Message.name`,
  `MessageItem.name`, `Message.logoUri`, `MessageItem.logoUri`.
- The fields are populated and continue to behave correctly until clients
  migrate to `safeAppInfo`.
- Removal is out of scope for this spec — a follow-up change after wallet
  rollouts confirm clients have migrated.
