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
| `POST /v1/cloud-cosigner/hooks/events` | Webhook intake for Transaction Service events (`Authorization: Basic <AUTH_TOKEN>`); queues a review for `PENDING_MULTISIG_TRANSACTION`, ignores other types. Alternative to the AMQP subscription for local or single-instance setups. |

## Running locally (demo)

The deployable boots without RabbitMQ (the AMQP connection retries in the
background; `GET /health/live` reports `KO` until a broker is reachable, which
the demo does not need). Events are pushed over the webhook instead.

```bash
chmod 0600 db_config/test/server.key
docker compose up -d db redis
yarn install
yarn env:generate            # writes .env with dummy values for every required variable
```

Append to `.env` (the private key below is a throwaway; generate your own with
`openssl rand -hex 32`):

```
APPLICATION_PORT=3001
ALLOW_CORS=true
AMQP_QUEUE=safe-cosigner
SAFE_CONFIG_BASE_URI=https://safe-config.staging.5afe.dev
SAFE_DATA_DECODER_BASE_URI=https://safe-decoder.staging.5afe.dev
FF_CLOUD_COSIGNER=true
CLOUD_COSIGNER_PRIVATE_KEY=0x<32 bytes hex>
CLOUD_COSIGNER_ANTHROPIC_API_KEY=sk-ant-...
```

`SAFE_CONFIG_BASE_URI` must point at the same environment the wallet talks to,
otherwise the cosigner looks the Safe up in a different Transaction Service.

```bash
yarn start:cosigner
curl localhost:3001/v1/cloud-cosigner        # cosigner address + default policy
```

Point the wallet at it (`NEXT_PUBLIC_CLOUD_COSIGNER_URL=http://localhost:3001`
in `apps/web/.env`, `CLOUD_COSIGNER` enabled in the sidebar feature-flag
editor), add the cosigner as an owner and propose a transaction. Then feed the
proposal to the cosigner the way the Transaction Service would:

```bash
curl -X POST localhost:3001/v1/cloud-cosigner/hooks/events \
  -H "Authorization: Basic $AUTH_TOKEN" -H 'content-type: application/json' \
  -d '{"type":"PENDING_MULTISIG_TRANSACTION","chainId":"11155111","address":"0x<safe>","safeTxHash":"0x<safeTxHash>"}'

curl localhost:3001/v1/chains/11155111/safes/0x<safe>/cloud-cosigner/reviews/0x<safeTxHash>
```

A small transfer to a known address is approved on the rules fast path without
calling the model; a transaction above the value threshold, to an unknown
contract, a `DELEGATECALL`, or a Safe settings change goes through the model
review, so those need a real API key.
