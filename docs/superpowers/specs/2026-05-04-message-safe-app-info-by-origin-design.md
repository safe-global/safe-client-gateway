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

1. **Extract `SafeAppInfoMapper` to a shared home.** Move from
   `src/modules/transactions/routes/mappers/common/safe-app-info.mapper.ts`
   to `src/modules/safe-apps/mappers/safe-app-info.mapper.ts`. The new home
   is the module that owns the `SafeApp` domain entity, so both the
   transactions and messages routes module depend on it without forming a
   transactions → messages or messages → transactions cross-dependency.
   Rename the class to reflect what it now does: `SafeAppByOriginMapper`
   with a single public method `findByOrigin(chainId, origin, logContext?)`.
   It returns the **domain `SafeApp`**, not the route `SafeAppInfo`.

2. **Generalize the signature.** The current method takes a
   `MultisigTransaction` so it can pull `origin` and `safeTxHash` (the
   latter is used only for log context). Replace this with two arguments:
   `chainId: string` and `origin: string | null`, plus an optional
   `logContext: string` for log lines. The return type changes from
   `SafeAppInfo | null` to `SafeApp | null` so each route can project the
   domain entity to its own response shape.

3. **Each consumer projects locally.** Transaction mappers continue to
   build `SafeAppInfo` (`new SafeAppInfo(safeApp.name, safeApp.url.replace(...), safeApp.iconUrl)`).
   `MessageMapper` builds the same `SafeAppInfo` and additionally surfaces
   `safeAppId = safeApp?.id ?? null` and the legacy flat `name` / `logoUri`.

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
     `safeAppId: number | null` (also marked `@deprecated`) so clients
     that haven't switched to reading from `safeAppInfo` see a useful
     value. The legacy flat `name` / `logoUri` likewise remain and are
     marked deprecated.

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
ones as deprecated:

```json
{
  // ...existing fields...

  "safeAppInfo": {
    "name": "App",
    "url": "https://app.example",
    "logoUri": "https://..."
  },

  "safeAppId": 24, // deprecated; same value as the resolved SafeApp.id, or null
  "name": "App", // deprecated; mirrors safeAppInfo.name
  "logoUri": "https://..." // deprecated; mirrors safeAppInfo.logoUri
}
```

When the message's `origin` is `null`, invalid JSON, or matches no listed
SafeApp, all four (`safeAppInfo`, `safeAppId`, `name`, `logoUri`) are
`null` together.

## Components

```
src/
  modules/
    safe-apps/
      domain/
        entities/safe-app.entity.ts       (existing)
      mappers/
        safe-app-info.mapper.ts            (NEW — moved + renamed from
                                            transactions/.../common/)
        safe-app-info.mapper.spec.ts       (NEW — moved spec)

    messages/
      domain/
        entities/message.entity.ts         (drop safeAppId field)
      messages.repository.ts                (drop safeAppId arg)
      messages.repository.interface.ts      (drop safeAppId arg)
      routes/
        entities/
          message.entity.ts                 (add safeAppInfo, deprecated safeAppId)
          message-item.entity.ts            (add safeAppInfo, deprecated safeAppId)
        mappers/
          message-mapper.ts                 (lookup by origin, populate
                                             safeAppInfo + safeAppId)
        messages.service.ts                 (drop safeAppId arg)

    queue/
      queue.interface.ts                    (drop safeAppId arg from postMessage)
      queue.service.ts                      (drop safeAppId arg)
      mappers/message.mapper.ts             (drop the `safeAppId: null`
                                             output line)

    transactions/
      routes/mappers/common/                (delete safe-app-info.mapper.*)
      routes/mappers/                       (every consumer of the old mapper
                                             updates the import path and
                                             projects SafeApp → SafeAppInfo
                                             locally — small per-file diff)
```

## Data flow (read path)

```
1. Controller hits MessagesService.getMessage(chainId, hash)
2. Service asks MessagesRepository → returns domain Message
   (no safeAppId field anymore; origin is JSON string)
3. MessageMapper.mapMessage:
     a. safeApp = await safeAppByOrigin.findByOrigin(chainId, message.origin, `messageHash=${hash}`)
     b. safeAppInfo = safeApp ? new SafeAppInfo(...) : null
     c. safeAppId = safeApp?.id ?? null
     d. name = safeApp?.name ?? null   // deprecated
     e. logoUri = safeApp?.iconUrl ?? null   // deprecated
4. Response Message returned
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

`SafeAppByOriginMapper.findByOrigin` mirrors the existing `SafeAppInfoMapper`
behaviour:

- `origin = null` → returns `null`, no log.
- `origin` not parseable as JSON → returns `null`, debug log
  (`logContext` substituted into the message).
- `origin` parses but no `url` field → returns `null`.
- `origin.url` matches no listed SafeApp → returns `null`, info log.
- Match found → returns the `SafeApp` domain entity.

Consumers always project `null → null`, so message responses degrade
gracefully when the origin can't be resolved.

## Testing

- `safe-app-info.mapper.spec.ts` (moved): retain coverage for null origin,
  invalid JSON, no-match, and match cases. Adapt fixtures from
  `transaction.origin` references to plain origin strings.
- `message-mapper.spec.ts`: replace `getSafeAppById` mocks with
  `SafeAppByOriginMapper.findByOrigin` mocks. New cases:
  - origin matches a listed SafeApp — `safeAppInfo`, `safeAppId`, `name`,
    `logoUri` are all populated and consistent.
  - origin matches no app — all four are `null`.
  - `origin = null` — all four are `null`.
  - origin is invalid JSON — all four are `null`.
- `messages.controller` integration spec:
  - Posting `{ message, signature, safeAppId, origin }` succeeds; the DTO
    still accepts `safeAppId`.
  - Response contains `safeAppInfo` and `safeAppId` derived from the
    origin URL.
  - Posting with a `safeAppId` that does **not** match the origin URL —
    response still uses the URL-derived SafeApp; the request `safeAppId`
    is ignored.
- Existing transaction mapper specs: re-run after the import-path change
  to confirm tests still pass; no behavioural change expected.

Acceptance: `yarn test:unit --testPathPattern='message|safe-app|multisig-transaction.mapper'`
green, plus `yarn lint`, `yarn format`, `yarn env:validate` clean.

## Deprecation timeline

- This change introduces deprecation marks on `CreateMessageDto.safeAppId`,
  `Message.safeAppId`, `MessageItem.safeAppId`, `Message.name`,
  `MessageItem.name`, `Message.logoUri`, `MessageItem.logoUri`.
- The fields are populated and continue to behave correctly until clients
  migrate to `safeAppInfo`.
- Removal is out of scope for this spec — a follow-up change after wallet
  rollouts confirm clients have migrated.
