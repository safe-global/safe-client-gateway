<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Billing Webhook Authentication

The CGW receives webhooks from the **billing service** at `POST /v1/billing/webhooks` and authenticates them with a service-to-service JWT bearer token.

The model is **"the receiver issues the credential it later checks."** The CGW mints a long-lived **ES256** (ECDSA P-256) token, provisions it to the billing service as a secret, and the billing service presents it on every call as `Authorization: Bearer <token>`. The CGW verifies each token offline against its own public key — no JWKS, no callback, no shared secret.

Minting is done by [`scripts/generate-token.ts`](../../../scripts/generate-token.ts), which signs either with a local private key (development) or via **AWS KMS** (staging/production). A token is accepted only if its ES256 signature, `iss`, `aud` and `exp` all check out *and* its payload carries the service-token markers; the exact claim set lives in [`billing-service-token.entity.ts`](domain/entities/billing-service-token.entity.ts).

> **Enforced:** when `CGW_ENV` is `production` or `staging` the script refuses to sign with a local private key, and the app's env validation rejects `BILLING_WEBHOOK_JWT_PRIVATE_KEY` at startup. Deployed environments must sign via KMS.

## Mint a token: development

```bash
# ES256 (EC P-256) keypair
openssl ecparam -genkey -name prime256v1 -noout -out ec-priv.pem
openssl ec -in ec-priv.pem -pubout -out ec-pub.pem

# Mint (defaults: --sub billing-service, --expires-in 1825)
BILLING_WEBHOOK_JWT_PRIVATE_KEY="$(cat ec-priv.pem)" yarn generate-token
```

Run the CGW with `FF_BILLING_SERVICE=true` and `BILLING_WEBHOOK_JWT_PUBLIC_KEY="$(cat ec-pub.pem)"`, then hand the minted token to the billing service. The app only ever needs the **public** key — keep the private key out of it.

## Mint a token: staging / production

Signing happens inside AWS KMS, so the private key never exists on disk. **Mint before deploying the receiver:** the mint output is the only place the public key appears, since there is no keypair to read it from.

> **Never run the mint in a CGW app pod.** The image ships the compiled script, so `kubectl exec` + `node dist/scripts/generate-token.js` looks like the obvious move — but the pod's `AWS_WEB_IDENTITY_TOKEN_FILE`/`AWS_ROLE_ARN` make the SDK sign as the CGW's **runtime** IRSA role, which has no `kms:Sign` and must not be given it. Run a separate Job under its own service account.

### 1. Collect the values you need

```bash
kubectl get pods -A | grep client-gateway            # namespace
kubectl -n <ns> get deploy <cgw-deploy> -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n <ns> get deploy <cgw-deploy> \
  -o jsonpath='{.spec.template.spec.imagePullSecrets}{"\n"}{.spec.template.spec.nodeSelector}{"\n"}'
aws eks describe-cluster --name <cluster> --query 'cluster.identity.oidc.issuer' --output text
```

The Job must reuse the deployment's `imagePullSecrets` and `nodeSelector` — a bare pod spec fails to pull the image.

Check whether the deployment overrides the issuer. If this prints nothing it is the default `safe-client-gateway` and you can ignore it:

```bash
kubectl -n <ns> get deploy <cgw-deploy> \
  -o jsonpath='{range .spec.template.spec.containers[*].env[?(@.name=="BILLING_WEBHOOK_JWT_ISSUER")]}{.value}{end}{"\n"}'
```

### 2. Create the KMS key and a mint role

Key: type **asymmetric**, spec **`ECC_NIST_P256`**, usage **`SIGN_VERIFY`**.

Then a dedicated `billing-token-minter` IAM role — **not** the CGW's runtime role. Permissions policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:Sign", "kms:GetPublicKey"],
    "Resource": "<key-arn>"
  }]
}
```

Trust policy, scoped to the service account created in step 3 (`<oidc>` is the issuer URL from step 1 without its `https://` prefix):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<acct>:oidc-provider/<oidc>" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": { "StringEquals": {
      "<oidc>:sub": "system:serviceaccount:<ns>:billing-token-minter",
      "<oidc>:aud": "sts.amazonaws.com"
    }}
  }]
}
```

Both actions are required, and both the identity policy **and** the KMS key policy must allow them.

### 3. Create the service account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: billing-token-minter
  namespace: <ns>
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<acct>:role/billing-token-minter
```

Verify it assumes the right role before minting — expect `assumed-role/billing-token-minter/…`, not the CGW's runtime role:

```bash
kubectl -n <ns> run mint-whoami --rm -it --restart=Never \
  --image=amazon/aws-cli --env=AWS_REGION=<region> \
  --overrides='{"spec":{"serviceAccountName":"billing-token-minter"}}' \
  -- sts get-caller-identity
```

### 4. Run the mint Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: billing-token-mint
  namespace: <ns>
spec:
  backoffLimit: 0
  template:
    metadata:
      annotations:
        # The token prints to stdout — keep it out of shipped logs.
        # `kubectl logs` still works; this only stops agent collection.
        ad.datadoghq.com/mint.logs_exclude: "true"
    spec:
      serviceAccountName: billing-token-minter
      restartPolicy: Never
      imagePullSecrets:              # copy from the CGW deployment (step 1)
        - name: <pull-secret>
      nodeSelector:                  # published images are linux/arm64 only
        kubernetes.io/arch: arm64
      containers:
        - name: mint
          image: <cgw-image>:<tag>
          command: ["node", "dist/scripts/generate-token.js", "--sub", "billing-service"]
          env:
            - { name: BILLING_WEBHOOK_JWT_KMS_KEY_ID, value: "<key-arn>" }
            - { name: AWS_REGION, value: "<region>" }
            # only if step 1 showed a non-default issuer:
            # - { name: BILLING_WEBHOOK_JWT_ISSUER, value: "<issuer>" }
```

Those are the only variables the script needs: it builds its configuration directly and never boots the app's env validation, so no other CGW config is required. `CGW_ENV` is irrelevant here — only the local-PEM gate reads it.

### 5. Read the output, then clean up

```bash
kubectl -n <ns> logs job/billing-token-mint
```

Copy **both** the token and the public key PEM, then:

1. Set `BILLING_WEBHOOK_JWT_PUBLIC_KEY` to the printed PEM on the CGW deployment (with `FF_BILLING_SERVICE=true`) and redeploy.
2. Provision the token to the billing service as its webhook bearer credential.
3. `kubectl -n <ns> delete job billing-token-mint`.

> **The token is a long-lived credential printed to stdout.** `logs_exclude` keeps it out of log collection, but `kubectl logs` serves it until the Job is deleted — hence step 3. Never mint from CI, which retains job output. If the token ever transits a log platform, rotate it.

### Off-cluster alternative

From a bastion, run the same image under an assumed mint role: `aws sts assume-role`, export the three `AWS_*` credentials, then `docker run … node dist/scripts/generate-token.js`. **`unset AWS_WEB_IDENTITY_TOKEN_FILE` first** — when it is set the SDK assumes `AWS_ROLE_ARN` and ignores static keys.

## Configuration

| Variable | Used by | Description | Default |
|---|---|---|---|
| `FF_BILLING_SERVICE` | app | Enables the webhook endpoint and its guard, plus the safe-billing-service API client. | `false` |
| `BILLING_WEBHOOK_JWT_PUBLIC_KEY` | app | ES256 public key (PEM) that verifies incoming tokens. Required when the flag is on — the app fails to boot without it. | — |
| `BILLING_WEBHOOK_JWT_ISSUER` | app + script | The CGW's own identifier, used as both `iss` and `aud`. Must match on both sides. | `safe-client-gateway` |
| `BILLING_WEBHOOK_JWT_KMS_KEY_ID` | script | Asymmetric KMS key id/ARN (`ECC_NIST_P256`). When set, signing goes through KMS. Needs `AWS_REGION` + credentials. | — |
| `BILLING_WEBHOOK_JWT_PRIVATE_KEY` | script | ES256 private key (PEM). Development only. Used when no KMS key is set. | — |

Exactly one signing input is required — `BILLING_WEBHOOK_JWT_KMS_KEY_ID` or `BILLING_WEBHOOK_JWT_PRIVATE_KEY`; if both are set, KMS wins. PEM values arriving with escaped newlines (`\n`) are normalized automatically.

Script arguments: `--sub` (the `sub` claim and `data.service_name`, default `billing-service`) and `--expires-in` (lifetime in days, default `1825`).

## Troubleshooting

Most script failures print their own actionable `ERROR:` line. These are the symptoms whose cause is not visible to the caller.

### Mint fails with `is not authorized to perform: kms:GetPublicKey` (or `kms:Sign`)

The role named in the error is the giveaway. If it is the CGW's runtime role, the mint ran with the app's identity — usually because it was launched inside an app pod. When `AWS_WEB_IDENTITY_TOKEN_FILE` is set the SDK assumes `AWS_ROLE_ARN` and ignores static keys, so the pod's identity wins even if you export mint credentials into the shell. Run the Job under the mint service account instead; do **not** fix this by granting `kms:Sign` to the runtime role.

If the principal is already correct, check the KMS key policy as well as the identity policy. The script reads the public key before signing, so a principal short of `kms:GetPublicKey` fails on that action first.

### The mint Job cannot pull the image

Read the reason from `kubectl -n <ns> describe pod -l job-name=billing-token-mint`:

- `no match for platform` — the pod landed on an amd64 node. Published images are **arm64 only** (see [`ci.yml`](../../../.github/workflows/ci.yml)), so the Job needs `nodeSelector: kubernetes.io/arch: arm64`.
- `unauthorized` / `pull access denied` — the Job has no registry credentials. Pull secrets are often attached to the *service account*, and the new mint SA has none; copy `imagePullSecrets` from the CGW deployment.

### Webhook calls return `401 Unauthorized`

The token failed verification — the CGW logs the specific reason at `warn` level. Common causes: it was signed with a key that doesn't match the deployed `BILLING_WEBHOOK_JWT_PUBLIC_KEY`; its `iss`/`aud` don't match the deployed `BILLING_WEBHOOK_JWT_ISSUER`; it has expired; or it lacks the service-token markers.

### Webhook calls return `404 Not Found`

The feature is disabled — set `FF_BILLING_SERVICE=true` and redeploy.

### The app fails to boot with a missing-public-key error

`FF_BILLING_SERVICE=true` was set without `BILLING_WEBHOOK_JWT_PUBLIC_KEY`. Set the public key or disable the flag; the fail-fast is intentional, since enabling the feature asserts the key is provisioned.

## Key rotation

There is no JWKS or `kid` metadata, so rotation is coordinated operationally: re-mint against a new key, then update both sides — `BILLING_WEBHOOK_JWT_PUBLIC_KEY` on the CGW and the stored bearer token on the billing service.
