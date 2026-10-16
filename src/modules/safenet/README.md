<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Safenet

## Payer

`FF_SAFENET` enables the Safenet module and defaults to false.
Set the Consensus, Oracle, and payer Safe variables listed in `.env.sample.json`, and `SAFENET_PAYER_KMS_KEY_ID`, the AWS KMS key that signs for the payer Safe.
The KMS key must have key spec `ECC_SECG_P256K1` and key usage `SIGN_VERIFY`. The AWS SDK environment sets its region and credentials; `AWS_WEB_IDENTITY_TOKEN_FILE` selects IRSA credentials.
The signer loads its public key on first use. CGW starts when KMS is down, and the first proposal fails.
A KMS call is not retried by the SDK. It fails after `SAFENET_KMS_CONNECTION_TIMEOUT_MS` (default 5000) to connect, or `SAFENET_KMS_REQUEST_TIMEOUT_MS` (default 10000) to answer.
For local development, set `AWS_ENDPOINT_URL_KMS` to point the SDK at a KMS emulator. It also sends CGW's field-encryption KMS client to the emulator.

The payer runs on Gnosis Chain (chain ID `100`) and needs a Safe `1.4.1` payer Safe with threshold 1 and the signer as an owner.
The payer reads the chain through `IBlockchainApiManager.getUncachedApi`, so the shared RPC cache never serves it a stale nonce or a missing receipt.
Before the first proposal, the payer reads `isOwner(signer)`. A false result throws `SafenetPayerError`, and nothing is relayed. The payer repeats the check until it passes once, then does not repeat it in this instance.
The nonce counter (Redis key `safenet_payer_nonce_100_<lowercase payer address>`, 60 seconds) is written only after a confirmed `ExecutionSuccess`, and covers RPC lag behind that execution. A failed write is logged and does not fail the proposal, because the next job reads the on-chain nonce. The counter is not a distributed lock. Run one instance per payer Safe.
The relay status is polled every `SAFENET_POLL_INTERVAL_MS` (default 1000) for up to `SAFENET_POLL_TIMEOUT_MS` (default 120000). After the relay reports the task as included, the receipt is polled the same way until it exists, and must show the payer Safe's `ExecutionSuccess`. A payer Safe with another version or threshold reverts before any fee moves.

`SafenetPayerError` means no payer transaction from this call can have paid the fee: nothing was relayed, or the relay rejected the request without broadcasting it.
Any other error is not classified and may follow a paid fee: a relay timeout or revert, a missing or reverted receipt, a receipt without `ExecutionSuccess`, or a failed relay request. The relay can accept a transaction and lose the response. Errors after the relay call carry the relay `taskId` and the payer nonce in the message. Anyone can land a copy of the signed payload first, so a revert does not prove that nothing was paid.
Check the payer Safe nonce and events on chain before any new proposal. The payer does not block later proposals after such an error. A repeated proposal can pay the fee again.
