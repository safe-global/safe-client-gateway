<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Safenet

## Payer

`FF_SAFENET` enables the Safenet payer, its queue, and the sponsored check route, and defaults to false. The payer is built only with the route, which also needs `FF_USERS` and `FF_BILLING_SERVICE`.
Set the Consensus, Oracle, and payer Safe variables listed in `.env.sample.json`, and `SAFENET_PAYER_KMS_KEY_ID`, the AWS KMS key that signs for the payer Safe.
The KMS key must have key spec `ECC_SECG_P256K1` and key usage `SIGN_VERIFY`. The AWS SDK environment sets its region and credentials; `AWS_WEB_IDENTITY_TOKEN_FILE` selects IRSA credentials.
The signer loads its public key on first use. CGW starts when KMS is down, and the first proposal fails.
A KMS call is not retried by the SDK. It fails after `SAFENET_PAYER_KMS_CONNECTION_TIMEOUT_MS` (default 5000) to connect, or `SAFENET_PAYER_KMS_REQUEST_TIMEOUT_MS` (default 10000) to answer.
For local development, set `AWS_ENDPOINT_URL_KMS` to point the SDK at a KMS emulator. It also sends CGW's field-encryption KMS client to the emulator.

The payer runs on Gnosis Chain (chain ID `100`) and needs a Safe `1.4.1` payer Safe with threshold 1 and the signer as an owner.
The payer reads the chain through `SAFENET_RPC_URI`, not the chain's RPC from the config service, which may admit only browser origins. It may carry an access token, so it is set as a secret.
Without `SAFENET_RPC_URI`, the payer falls back to the chain's RPC from the config service without a warning. CGW still starts, but every proposal fails before relay if that RPC rejects the payer.
The payer reads through `IBlockchainApiManager.getUncachedApi`, so the shared RPC cache never serves it a stale nonce or a missing receipt.
Before the first proposal, the payer reads `isOwner(signer)` and `getThreshold()`. A false owner or a threshold other than 1 throws `SafenetPayerError`, and nothing is relayed. The payer repeats the check until it passes once, then does not repeat it in this instance.
The nonce counter (Redis key `safenet_payer_nonce_100_<lowercase payer address>`, 60 seconds) is written only after a confirmed `ExecutionSuccess`, and covers RPC lag behind that execution. A failed write is logged and does not fail the proposal, because the next job reads the on-chain nonce. The counter is not a lock. The `safenet-checks` queue below serializes proposals across instances.
The relay status is polled every `SAFENET_POLL_INTERVAL_MS` (default 1000) for up to `SAFENET_POLL_TIMEOUT_MS` (default 120000). After the relay reports the task as included, the receipt is polled the same way until it exists, and must show the payer Safe's `ExecutionSuccess`. A payer Safe with another version or threshold reverts before any fee moves.

`SafenetPayerError` means no payer transaction from this call can have paid the fee: nothing was relayed (this includes an RPC or signer error before the relay call, which keeps its cause), or the relay rejected the request without broadcasting it.
Any other error is not classified and may follow a paid fee: a relay timeout or revert, a missing or reverted receipt, a receipt without `ExecutionSuccess`, or a failed relay request. The relay can accept a transaction and lose the response. Errors after the relay call carry the relay `taskId` and the payer nonce in the message. Anyone can land a copy of the signed payload first, so a revert does not prove that nothing was paid.
Check the payer Safe nonce and events on chain before any new proposal. The payer does not block later proposals after such an error. A repeated proposal can pay the fee again.

## Sponsored checks

`POST /v1/spaces/:spaceId/chains/:chainId/safes/:safeAddress/safenet/checks` with `{ "safeTxHash": "0x…" }` queues one payer proposal. It answers 202 with no body, whether the check was queued or already queued.
The workspace in the path (`spaceId`, a UUID) is the one that pays; CGW never picks a workspace itself.
The route needs `FF_SAFENET`, `FF_USERS`, `FF_BILLING_SERVICE`, and a signed-in user. CGW accepts a request when all of these hold, in this order:

- The user is an active member of the workspace.
- The chain lists the `SAFENET_CHECKS` feature. Otherwise the route answers 501: the chain does not offer checks, so this is no permission failure.
- The workspace holds the Safe on that chain.
- The workspace has the `policies` entitlement, which comes with Business and Enterprise like Safenet checks. CGW writes it from the `FEATURE_POLICIES` metadata of the workspace subscription, which every Safe Pro payment link sets. The `safenet_checks` entitlement is seeded but not read yet: no subscription carries `FEATURE_SAFENET_CHECKS`. Otherwise the route answers 402 `FEATURE_NOT_GRANTED`.
- The Safe is version 1.3.0 or newer, because Consensus hashes with that domain.
- The transaction is pending, belongs to this Safe, and has a confirmation from a current owner.
- The workspace has made fewer than `SAFENET_CHECKS_PER_SPACE_PER_DAY` requests (default 100) on this UTC day that tried to add a job. A request for a transaction that already has a job does not count. A transaction whose job was removed after a payer failure counts again when it is requested again. Past the limit, the route answers 429.

The BullMQ queue `safenet-checks` uses the lowercase job ID `<chainId>-<safe>-<safeTxHash>`. A repeated request for the same transaction adds no job while that job exists. A global concurrency of 1, set at startup, serializes the payer Safe nonce across instances.
A job runs up to `SAFENET_CHECKS_QUEUE_ATTEMPTS` times (default 3, at most 10) with the backoff of `SAFENET_CHECKS_QUEUE_BACKOFF_TYPE` (default `exponential`) and `SAFENET_CHECKS_QUEUE_BACKOFF_DELAY` (default 5000 ms). It retries only after a `SafenetPayerError`. Any other error fails the job at once, because a retry could pay the fee again.
Finished jobs stay for `SAFENET_CHECKS_QUEUE_REMOVE_ON_COMPLETE_AGE` seconds, and failed jobs for `SAFENET_CHECKS_QUEUE_REMOVE_ON_FAIL_AGE` seconds. Both default to 30 days (2592000) and cannot be lower, because the job ID blocks a repeated request while the job exists. A job that fails with a `SafenetPayerError` on its last attempt is removed, because it paid nothing, so the next signature queues the transaction again. Any other failed job stays and blocks a new request for the same transaction. Check the payer Safe on chain, then remove the job to allow a new check.
