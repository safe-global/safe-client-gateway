# Billing Webhook Authentication

The CGW receives webhooks from the **billing service** at `POST /v1/billing/webhooks` and authenticates their origin with a **service-to-service JWT bearer token**.

The model is **"the receiver issues the credential it later checks."** The CGW mints a long-lived **ES256** (ECDSA P-256) token signed with its **private** key, provisions that token to the billing service as a secret, and the billing service presents it on every webhook call via the `Authorization: Bearer <token>` header. The CGW verifies each incoming token **statelessly/offline** against its own **public** key — no JWKS, no callback, no shared secret over the body.

This guide covers generating that token with the `generate-token` script.

## Quick Start

```bash
# 1. Generate an ES256 (EC P-256) keypair
openssl ecparam -genkey -name prime256v1 -noout -out ec-priv.pem
openssl ec -in ec-priv.pem -pubout -out ec-pub.pem

# 2. Mint a token with the private key (default subject + ~5y expiry)
BILLING_WEBHOOK_JWT_PRIVATE_KEY="$(cat ec-priv.pem)" yarn generate-token

# Custom subject and expiry (in days)
BILLING_WEBHOOK_JWT_PRIVATE_KEY="$(cat ec-priv.pem)" \
  yarn generate-token --sub billing-service --expires-in 1825
```

Then configure the **running CGW** with the matching public key (see [Deploying](#deploying-the-receiver)) and hand the minted token to the billing service.

## Command Arguments

| Argument | Description | Required | Default |
|----------|-------------|----------|---------|
| `--sub` | Subject (`sub`) claim — also used as `data.service_name` | No | `billing-service` |
| `--expires-in` | Token lifetime in **days** | No | `1825` (~5 years) |

## Environment

The script reads the **private key** directly from the environment (it is never stored in the running app's config). The **issuer** is resolved from the app config the same way the verifier resolves it, so a minted token always matches what the guard expects.

| Variable | Used by | Description | Default |
|----------|---------|-------------|---------|
| `BILLING_WEBHOOK_JWT_PRIVATE_KEY` | **script only** | ES256 (EC P-256) private key, PEM. **Required** to mint. | — |
| `BILLING_WEBHOOK_JWT_ISSUER` | script + app | The CGW's own identifier — used as both `iss` and `aud`. | `safe-client-gateway` |

> PEM keys passed via env often arrive with escaped newlines (`\n`); the script normalizes these automatically.

## Token Structure

```jsonc
{
  "iss": "safe-client-gateway",        // issuer = the CGW
  "sub": "billing-service",
  "aud": ["safe-client-gateway"],      // audience = the CGW (same identifier as iss)
  "iat": 1700000000,
  "exp": 2015360000,                   // iat + (--expires-in days)
  "roles": ["SERVICE_ACCESS"],
  "data": {
    "service_name": "billing-service", // = --sub
    "permission_type": "SERVICE_ACCESS",
    "user_type": "SERVICE_USER"
  }
}
```

- **Algorithm:** `ES256` (ECDSA, P-256, SHA-256) — asymmetric. The CGW signs with its private key and verifies with the matching public key.
- **Lifetime:** long-lived (multi-year), minted once and stored by the billing service as a secret. Not requested per call.

## How the receiver validates each request

The webhook is processed only if **both** layers pass:

1. **Cryptographic / standard claims** — verify the ES256 signature with the public key, and confirm `iss`, `aud`, and `exp`.
2. **Authorization** — confirm it is a *service* token: either `roles` contains `SERVICE_ACCESS`, **or** `data` carries `permission_type = SERVICE_ACCESS`, `user_type = SERVICE_USER`, and a non-empty `service_name`.

Verification is fully stateless/offline (public key + expected claims; no callback to any other service).

## Deploying the receiver

The webhook endpoint is **gated behind a feature flag** and reads its public key from config:

| Variable | Description |
|----------|-------------|
| `FF_BILLING_WEBHOOK` | Set to `true` to enable the `POST /v1/billing/webhooks` endpoint and its auth guard. Off by default. |
| `BILLING_WEBHOOK_JWT_PUBLIC_KEY` | ES256 public key (PEM) used to verify incoming tokens. |
| `BILLING_WEBHOOK_JWT_ISSUER` | Must match the issuer used at mint time (default `safe-client-gateway`). |

End-to-end provisioning flow:

1. Generate the EC P-256 keypair (above).
2. Deploy the CGW with `FF_BILLING_WEBHOOK=true` and `BILLING_WEBHOOK_JWT_PUBLIC_KEY` set to the **public** key.
3. Mint a token with the **private** key using this script.
4. Provision the token to the billing service as the bearer credential for its webhook calls.

> The CGW only ever needs the **public** key at runtime. Keep the **private** key out of the running app — use it only at mint time and store it securely.

## Troubleshooting

### `ERROR: BILLING_WEBHOOK_JWT_PRIVATE_KEY environment variable is not defined`
The script had no private key to sign with. Export `BILLING_WEBHOOK_JWT_PRIVATE_KEY` with the PEM contents of your EC P-256 private key.

### `ERROR: Invalid --expires-in value`
`--expires-in` must be a positive whole number of days.

### Webhook calls return `401 Unauthorized`
The token failed verification. Common causes:
- The token was signed with a private key that doesn't match the deployed `BILLING_WEBHOOK_JWT_PUBLIC_KEY`.
- `iss`/`aud` in the token don't match the deployed `BILLING_WEBHOOK_JWT_ISSUER` (e.g. minted with a different issuer than the app is configured with).
- The token has expired.
- The token lacks the service-token markers (`SERVICE_ACCESS` role / `SERVICE_USER` data).

The CGW logs the specific reason at `warn` level (token-present failures only).

### Webhook calls return `404 Not Found`
The feature is disabled — set `FF_BILLING_WEBHOOK=true` and redeploy.

### The app fails to boot with a missing-public-key error
`FF_BILLING_WEBHOOK=true` was set but `BILLING_WEBHOOK_JWT_PUBLIC_KEY` was not provisioned. Either set the public key or disable the flag. (Fail-fast is intentional — enabling the feature asserts the key is provisioned.)

## Security Considerations

1. **Keep the private key out of the app.** Only the mint script needs it; the running CGW verifies with the public key alone.
2. **Treat the minted token like a password.** Never commit it to version control.
3. **Rotate keys operationally.** There is no JWKS/`kid` metadata — rotation is coordinated by re-minting against a new keypair and updating both sides.
4. **Use a descriptive `--sub`** so it's clear which service/credential a token belongs to.
