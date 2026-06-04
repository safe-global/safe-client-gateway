<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Queue-service origin enrichment on executed transactions

Date: 2026-04-24
Status: Approved

## Goal

In `SafeRepository.getAllExecutedTransactions` (reached via
`getTransactionHistory`), override each multisig entry's `origin` field with a
value derived from the queue service's `originName` / `originUrl`. All other
fields remain sourced from the transaction service. Non-multisig entries
(Ethereum, Module, Creation) are unchanged.

## Motivation

`origin` metadata (the originating app name/URL attached to a multisig
transaction) is now authoritative in the queue service. The transaction
service's `origin` may be stale or absent for transactions that were proposed
through the queue service. History consumers should see the queue-service value
when available.

## Non-goals

- No change to `getMultisigTransaction`, `getMultiSigTransaction`,
  `getMultisigTransactions`, or any queue/pending code path.
- No new queue service endpoint. A batch-by-`safeTxHash` endpoint was
  considered but is out of scope for this change (see
  [Alternatives considered](#alternatives-considered)).
- No change to the `Transaction` or `MultisigTransaction` domain schemas.

## Design

### Flow

1. Fetch the page from the transaction service and parse it with
   `TransactionTypePageSchema` (unchanged from today).
2. Collect the `safeTxHash` of every entry with
   `txType === 'MULTISIG_TRANSACTION'`.
3. Fetch each hash in parallel from the queue service using
   `offchainService.getMultisigTransaction({ chainId, safeTxHash })`, wrapped
   in `Promise.allSettled` so per-hash failures do not cascade.
4. Build a `Map<safeTxHash, string | null>` whose value is
   `buildOrigin(originName, originUrl)` from the queue-service record.
5. Return a new page whose `results` mirror the input, with each multisig
   entry's `origin` overridden iff the hash is present in the map. Non-multisig
   entries and multisig entries without a queue record pass through unchanged.

### Error handling

- Each per-hash fetch runs independently via `Promise.allSettled`.
- On a rejected settlement: log a warning with the `safeTxHash`, `chainId`, and
  error; omit that hash from the map. The corresponding transaction keeps the
  transaction-service `origin`.
- If the queue service is fully unreachable, every settlement rejects and every
  multisig entry falls back to the tx-service origin. The overall request still
  succeeds.

### Implementation shape

- A private helper method on `SafeRepository`, e.g.
  `enrichWithQueueOrigins(page, chainId)`, keeps `getAllExecutedTransactions`
  small and readable.
- Reuses the existing `isMultisigTransaction` type guard from
  `modules/safe/domain/entities/transaction.entity.ts`.
- Reuses `buildOrigin` from `modules/offchain/helpers/origin.helper.ts`.
- Queue-service responses are parsed via the existing
  `OffchainMultisigTransactionSchema`.

## Testing

Unit tests against `SafeRepository.getAllExecutedTransactions` (or equivalent
layer):

- Happy path: every multisig entry in the page has its `origin` replaced with
  the queue-service value.
- Mixed page (multisig + ethereum + module + creation): only multisig entries
  are modified; other entries pass through byte-identical.
- Partial failure: one per-hash fetch rejects; other multisig entries are still
  enriched; the failing entry keeps its tx-service origin; a warning is logged.
- All queue fetches fail: every multisig entry keeps its tx-service origin;
  the outer call still returns successfully.
- Queue returns `null` `originName` and `originUrl`: entry's final `origin` is
  `null` (per `buildOrigin` contract).
- Empty page / no multisig entries: no queue-service calls are made.

## Alternatives considered

- **Batch endpoint on the queue service.** Adding
  `GET /api/v1/multisig-transactions?safeTxHashes=…` would collapse N calls
  into one. No such endpoint exists today; shipping it requires a queue-service
  change and cross-team coordination. The mapping logic here does not depend
  on the transport, so the endpoint can be added later without reshaping this
  code.
- **Single list fetch** (`GET /api/v1/multisig-transactions?safes=X:chain&executed=true`).
  One round-trip, but pagination between the two services is not guaranteed to
  align, so some hashes from the tx-service page could be absent from the
  queue-service list page. Correlation is exact only with per-hash lookups.
- **Skip enrichment on history.** Leaves `origin` stale for
  queue-service-proposed transactions. Rejected.

## Open questions

None outstanding as of writing.
