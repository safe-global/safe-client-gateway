<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Cloud cosigner

An owner-as-a-service for Safe accounts. Owners add the cosigner's address as
an extra owner and raise the threshold by one; from then on every proposed
transaction of that Safe is checked against a per-Safe policy and, when it
passes, confirmed by the cosigner.

## Deployable

The cosigner runs as its own process from the same image as the gateway:

```
node dist/src/cosigner.main.js      # production
yarn start:cosigner                 # development (nest start --entryFile)
```

`src/cosigner-app.module.ts` mounts the shared infrastructure plus this module,
`health` and `about`. The gateway's `AppModule` never imports
`CloudCosignerModule`.

Environment on top of the gateway's:

| Variable | Purpose |
| --- | --- |
| `FF_CLOUD_COSIGNER=true` | Required; the process refuses to boot without it. |
| `AMQP_QUEUE` | Must differ from the gateway's queue so both bind their own queue to the Transaction Service fanout exchange. |
| `CLOUD_COSIGNER_KMS_KEY_ID` | `ECC_SECG_P256K1` asymmetric KMS key (sign/verify). Mandatory in production and staging. |
| `CLOUD_COSIGNER_PRIVATE_KEY` | Development-only alternative; rejected in deployed environments. |
| `CLOUD_COSIGNER_ANTHROPIC_API_KEY`, `CLOUD_COSIGNER_MODEL` | Reviewer credentials and model. |
| `CLOUD_COSIGNER_DEFAULT_*` | Policy defaults for Safes without a stored policy. |

## Flow

```
PENDING_MULTISIG_TRANSACTION ─▶ CloudCosignerEventsSubscriber ─▶ BullMQ job
  ─▶ CloudCosignerService.processReview
       ├─ cosigner not an owner? ─▶ stop (no database write)
       ├─ claim review row (idempotent per chain + safeTxHash)
       ├─ executed / stale nonce / already confirmed? ─▶ SKIPPED
       ├─ recomputed safeTxHash ≠ reported? ─▶ REJECTED
       ├─ evaluatePolicy: value threshold, unknown value, unknown contract,
       │   delegatecall outside MultiSend, Safe settings change
       ├─ no rule ─▶ sign + addConfirmation ─▶ APPROVED (mode RULES)
       └─ rule(s) ─▶ TransactionReviewer (Claude, structured verdict)
             ├─ approve ─▶ sign + addConfirmation ─▶ APPROVED (mode LLM)
             └─ reject / refusal ─▶ REJECTED, signature withheld
```

Confirmations go through `ISafeRepository.addConfirmation`, i.e. the same
`TransactionVerifierHelper` path client confirmations take.

## HTTP surface

| Route | Purpose |
| --- | --- |
| `GET /v1/cloud-cosigner` | Cosigner address and default policy. |
| `GET /v1/chains/:chainId/safes/:safeAddress/cloud-cosigner` | Whether the cosigner is an owner, and the effective policy. |
| `PUT /v1/chains/:chainId/safes/:safeAddress/cloud-cosigner/policy` | Store a policy; body carries an EIP-191 owner signature over `buildPolicyMessage(...)`. |
| `GET /v1/chains/:chainId/safes/:safeAddress/cloud-cosigner/reviews/:safeTxHash` | Verdict and reasoning for one proposal. |
