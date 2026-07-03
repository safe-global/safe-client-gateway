<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->
 
# Billing Webhook Authentication

The CGW receives webhooks from the **billing service** at `POST /v1/billing/webhooks` and authenticates their origin with a **service-to-service JWT bearer token**.

The model is **"the receiver issues the credential it later checks."** The CGW mints a long-lived **ES256** (ECDSA P-256) token signed with its **private** key, provisions that token to the billing service as a secret, and the billing service presents it on every webhook call via the `Authorization: Bearer <token>` header. The CGW verifies each incoming token **statelessly/offline** against its own **public** key — no JWKS, no callback, no shared secret over the body.

This guide covers generating that token with the `generate-token` script, which
signs either with a **local private key** (dev/CI) or via **AWS KMS** (production).

## Quick Start (development only)

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

## Signing with KMS (production)

In production, sign via an asymmetric AWS KMS key so the private key never exists on disk or in the environment.

1. Create a KMS key: type **asymmetric**, spec **`ECC_NIST_P256`**, usage **`SIGN_VERIFY`**.
2. Grant **`kms:Sign`** and **`kms:GetPublicKey`** on that key to the principal that **runs the mint** (see [IAM](#iam-which-principal-signs) below).
3. Mint — this signs via KMS and also prints the public key PEM to configure the verifier:
   ```bash
   BILLING_WEBHOOK_JWT_KMS_KEY_ID=<arn> \
     yarn generate-token --sub billing-service --expires-in 1825
   ```
   Credentials come from whatever AWS principal runs the script (its IRSA role, an assumed role, or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`); region from `AWS_REGION`.
4. Set the printed public key as `BILLING_WEBHOOK_JWT_PUBLIC_KEY` on the running CGW, and provision the token to the billing service.

The running app **never talks to KMS** — it verifies offline with the public key. KMS affects only minting.

> **Enforced:** when `CGW_ENV=production`, the script requires `BILLING_WEBHOOK_JWT_KMS_KEY_ID` and refuses to mint with a local private key. The local-PEM path is for dev/CI only.

### IAM: which principal signs

- **The running CGW needs *no* KMS permissions.** It verifies offline with the configured public key and never calls KMS. Do **not** add `kms:Sign` to the app's runtime IRSA role (the same role backing SES, etc.).
- **Grant `kms:Sign` + `kms:GetPublicKey` to a dedicated mint principal** — e.g. a CI role, a bastion role, or an operator — scoped to the billing key ARN.
- **Run the mint from that principal, outside the app pod** (CI / bastion / local). Minting is one-time provisioning, so this is the natural place, and it keeps signing capability off the app/SES role.

## Command Arguments

| Argument | Description | Required | Default |
|----------|-------------|----------|---------|
| `--sub` | Subject (`sub`) claim — also used as `data.service_name` | No | `billing-service` |
| `--expires-in` | Token lifetime in **days** | No | `1825` (~5 years) |

Both `--flag value` and `--flag=value` forms are accepted. Unknown flags are rejected (the script exits with an error) rather than ignored, so a typo can't silently mint a token with default values.

## Environment

The signing key (local PEM **or** KMS key id) is read directly from the environment and is never stored in the running app's config. The **issuer** is resolved from the app config the same way the verifier resolves it, so a minted token always matches what the guard expects.

| Variable | Used by | Description | Default |
|----------|---------|-------------|---------|
| `BILLING_WEBHOOK_JWT_KMS_KEY_ID` | **script only** | Asymmetric KMS key id/ARN (`ECC_NIST_P256`). When set, the script signs via KMS. Needs `AWS_REGION` + credentials. | — |
| `BILLING_WEBHOOK_JWT_PRIVATE_KEY` | **script only** | ES256 (EC P-256) private key, PEM. Used when no KMS key is set (dev/CI). | — |
| `BILLING_WEBHOOK_JWT_ISSUER` | script + app | The CGW's own identifier — used as both `iss` and `aud`. | `safe-client-gateway` |

Exactly one signing input is required: `BILLING_WEBHOOK_JWT_KMS_KEY_ID` (KMS mode, preferred) **or** `BILLING_WEBHOOK_JWT_PRIVATE_KEY` (local mode). If both are set, KMS wins.

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

### Running the token-mint in a deployed environment

Run the CGW image as a **one-off workload** under the mint principal (see [IAM](#iam-which-principal-signs)) — not the app's runtime role. Invoke the compiled script `node dist/scripts/generate-token.js`.

**Option A — `docker run` on a bastion or CI, with the mint role's credentials:**
```bash
# temp creds for a principal that has kms:Sign + kms:GetPublicKey on the billing key
eval "$(aws sts assume-role \
  --role-arn arn:aws:iam::<acct>:role/billing-token-minter --role-session-name mint \
  --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text \
  | awk '{print "export AWS_ACCESS_KEY_ID="$1"\nexport AWS_SECRET_ACCESS_KEY="$2"\nexport AWS_SESSION_TOKEN="$3}')"

docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
  -e AWS_REGION=<region> \
  -e BILLING_WEBHOOK_JWT_KMS_KEY_ID=<key-arn> \
  <cgw-image>:<tag> \
  node dist/scripts/generate-token.js --sub billing-service --expires-in 1825
```

**Option B — a one-off Kubernetes `Job` using the same image + a mint service account:**
```yaml
apiVersion: batch/v1
kind: Job
metadata: { name: billing-token-mint }
spec:
  template:
    spec:
      serviceAccountName: billing-token-minter   # IRSA-annotated with the mint role (kms:Sign, kms:GetPublicKey)
      restartPolicy: Never
      containers:
        - name: mint
          image: <cgw-image>:<tag>
          command: ["node", "dist/scripts/generate-token.js", "--sub", "billing-service"]
          env:
            - { name: BILLING_WEBHOOK_JWT_KMS_KEY_ID, value: "<key-arn>" }
            - { name: AWS_REGION, value: "<region>" }
```
Read the token + public-key PEM from `kubectl logs job/billing-token-mint`, then delete the Job.

Notes:
- **Issuer must match the verifier.** If the app overrides `BILLING_WEBHOOK_JWT_ISSUER`, set the same value on the mint workload so `iss`/`aud` line up.
- **`CGW_ENV` is irrelevant in KMS mode** — the production gate only blocks *local-PEM* signing, so the mint workload doesn't need `CGW_ENV=production`.

## Troubleshooting

### `ERROR: No signing key configured`
The script had nothing to sign with. Set `BILLING_WEBHOOK_JWT_KMS_KEY_ID` (KMS mode) or `BILLING_WEBHOOK_JWT_PRIVATE_KEY` (local PEM). In KMS mode, also set `AWS_REGION`.

### `ERROR: Production requires KMS signing`
`CGW_ENV=production` but no `BILLING_WEBHOOK_JWT_KMS_KEY_ID` was set. Production must sign via KMS; a local private key is not accepted. Set the KMS key id (or run the mint outside production if you intended local signing).

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

1. **Keep the private key out of the app.** Only the mint script needs it; the running CGW verifies with the public key alone. **Prefer KMS signing in production** so the private key never exists as extractable material anywhere.
2. **Treat the minted token like a password.** Never commit it to version control.
3. **Rotate keys operationally.** There is no JWKS/`kid` metadata — rotation is coordinated by re-minting against a new keypair and updating both sides.
4. **Use a descriptive `--sub`** so it's clear which service/credential a token belongs to.
