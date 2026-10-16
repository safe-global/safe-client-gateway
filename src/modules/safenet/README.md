<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Safenet

## Payer

`FF_SAFENET` enables the Safenet payer and defaults to false.
Set the Consensus, Oracle, and payer Safe variables listed in `.env.sample.json`.

The payer runs on Gnosis Chain (chain ID `100`) and needs a Safe `1.4.1` payer Safe.
The payer reads the chain through `IBlockchainApiManager.getUncachedApi`, so the shared RPC cache never serves it a stale nonce or a missing receipt.
The nonce counter (Redis key `safenet_payer_nonce_100_<lowercase payer address>`, 60 seconds) is written only after a confirmed `ExecutionSuccess`, and covers RPC lag behind that execution. A failed write is logged and does not fail the proposal, because the next job reads the on-chain nonce. The counter is not a distributed lock. Run one instance per payer Safe.
The relay status is polled every `SAFENET_POLL_INTERVAL_MS` (default 1000) for up to `SAFENET_POLL_TIMEOUT_MS` (default 120000). After the relay reports the task as included, the receipt is polled the same way until it exists, and must show the payer Safe's `ExecutionSuccess`. A misconfigured payer Safe reverts before any fee moves.

`SafenetPayerError` means no payer transaction from this call can have paid the fee: nothing was relayed, or the relay rejected the request without broadcasting it.
Any other error is not classified and may follow a paid fee: a relay timeout or revert, a missing or reverted receipt, a receipt without `ExecutionSuccess`, or a failed relay request. The relay can accept a transaction and lose the response. Errors after the relay call carry the relay `taskId` and the payer nonce in the message. Anyone can land a copy of the signed payload first, so a revert does not prove that nothing was paid.
Check the payer Safe nonce and events on chain before any new proposal. The payer does not block later proposals after such an error. A repeated proposal can pay the fee again.
