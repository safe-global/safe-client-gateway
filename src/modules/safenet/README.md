<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Safenet

## Payer

`FF_SAFENET` enables the Safenet module and defaults to false.
Set the Consensus, Oracle, and payer Safe variables listed in `.env.sample.json`, and `SAFENET_PAYER_KMS_KEY_ID`, the AWS KMS key that signs for the payer Safe.
The KMS key must have key spec `ECC_SECG_P256K1` and key usage `SIGN_VERIFY`. The AWS SDK environment sets its region and credentials; `AWS_WEB_IDENTITY_TOKEN_FILE` selects IRSA credentials.
The signer loads its public key on first use. CGW starts when KMS is down, and the first proposal fails.
A KMS call is not retried by the SDK. It fails after `SAFENET_PAYER_KMS_CONNECTION_TIMEOUT_MS` (default 5000) to connect, or `SAFENET_PAYER_KMS_REQUEST_TIMEOUT_MS` (default 10000) to answer.
For local development, set `AWS_ENDPOINT_URL_KMS` to point the SDK at a KMS emulator. It also sends CGW's field-encryption KMS client to the emulator.

The payer runs on Gnosis Chain (chain ID `100`) and needs a Safe `1.4.1` payer Safe with threshold 1 and the signer as an owner.
The payer reads the chain through `IBlockchainApiManager.getUncachedApi`, so the shared RPC cache never serves it a stale nonce or a missing receipt.
Before the first proposal, the payer reads `isOwner(signer)` and `getThreshold()`. A false owner or a threshold other than 1 throws `SafenetPayerError`, and nothing is relayed. The payer repeats the check until it passes once, then does not repeat it in this instance.
The nonce counter (Redis key `safenet_payer_nonce_100_<lowercase payer address>`, 60 seconds) is written only after a confirmed `ExecutionSuccess`, and covers RPC lag behind that execution. A failed write is logged and does not fail the proposal, because the next job reads the on-chain nonce. The counter is not a lock. The `safenet-checks` queue below serializes proposals across instances.
The relay status is polled every `SAFENET_POLL_INTERVAL_MS` (default 1000) for up to `SAFENET_POLL_TIMEOUT_MS` (default 120000). After the relay reports the task as included, the receipt is polled the same way until it exists, and must show the payer Safe's `ExecutionSuccess`. A payer Safe with another version or threshold reverts before any fee moves.

`SafenetPayerError` means no payer transaction from this call can have paid the fee: nothing was relayed (this includes an RPC or signer error before the relay call, which keeps its cause), or the relay rejected the request without broadcasting it.
Any other error is not classified and may follow a paid fee: a relay timeout or revert, a missing or reverted receipt, a receipt without `ExecutionSuccess`, or a failed relay request. The relay can accept a transaction and lose the response. Errors after the relay call carry the relay `taskId` and the payer nonce in the message. Anyone can land a copy of the signed payload first, so a revert does not prove that nothing was paid.
Check the payer Safe nonce and events on chain before any new proposal. The payer does not block later proposals after such an error. A repeated proposal can pay the fee again.

## Sponsored check queue

The BullMQ queue `safenet-checks` uses the lowercase job ID `<chainId>-<safe>-<safeTxHash>`. A repeated job for the same transaction is not added while that job exists. A global concurrency of 1, set at startup, serializes the payer Safe nonce across instances.
A job runs up to `SAFENET_CHECKS_QUEUE_ATTEMPTS` times (default 3, at most 10) with the backoff of `SAFENET_CHECKS_QUEUE_BACKOFF_TYPE` (default `exponential`) and `SAFENET_CHECKS_QUEUE_BACKOFF_DELAY` (default 5000 ms). It retries only after a `SafenetPayerError`. Any other error fails the job at once, because a retry could pay the fee again.
Finished jobs stay for `SAFENET_CHECKS_QUEUE_REMOVE_ON_COMPLETE_AGE` seconds, and failed jobs for `SAFENET_CHECKS_QUEUE_REMOVE_ON_FAIL_AGE` seconds. Both default to 30 days (2592000) and cannot be lower, because the job ID blocks a repeated request while the job exists. A job that fails with a `SafenetPayerError` on its last attempt is removed, because it paid nothing, so the transaction can be queued again. Any other failed job stays and blocks a new job for the same transaction. Check the payer Safe on chain, then remove the job to allow a new check.
