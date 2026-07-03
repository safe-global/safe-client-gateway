// SPDX-License-Identifier: FSL-1.1-MIT
// biome-ignore-all lint/suspicious/noConsole: CLI script — console is the intended output.

/**
 * Mints the long-lived ES256 service-to-service token that the billing service
 * presents on each webhook call to the CGW (`Authorization: Bearer <token>`).
 *
 * The CGW is the receiver that issues the credential it later verifies. The
 * running app verifies incoming tokens offline with the matching public key
 * (BILLING_WEBHOOK_JWT_PUBLIC_KEY); it never signs.
 *
 * Two signing modes (the issuer is resolved from app config either way, so a
 * minted token always matches what the guard verifies):
 *   - **KMS** — set BILLING_WEBHOOK_JWT_KMS_KEY_ID (asymmetric ECC_NIST_P256
 *     key). The private key never leaves KMS. Also prints the public key PEM to
 *     configure the verifier. Requires AWS_REGION + credentials (AWS_WEB_IDENTITY_TOKEN_FILE).
 *   - **Local PEM** — set BILLING_WEBHOOK_JWT_PRIVATE_KEY (ES256 EC P-256 PEM).
 *     For dev/CI only; rejected when CGW_ENV=production (KMS is required there).
 *
 * Usage:
 *   # local key
 *   BILLING_WEBHOOK_JWT_PRIVATE_KEY="$(cat ec-priv.pem)" \
 *     yarn generate-token --sub billing-service --expires-in 1825
 *   # KMS
 *   BILLING_WEBHOOK_JWT_KMS_KEY_ID=<arn> \
 *     yarn generate-token --sub billing-service
 *
 * See src/modules/billing/README.md for the full usage and provisioning guide.
 */
import { createPublicKey } from 'node:crypto';
import { parseArgs } from 'node:util';
import configuration from '@/config/entities/configuration';
import { AwsKmsSignerService } from '@/datasources/kms/aws-kms-signer.service';
import {
  BillingAuthService,
  DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT,
} from '@/modules/billing/domain/billing-auth.service';

const DEFAULT_EXPIRES_IN_DAYS = 5 * 365; // ~5 years, long-lived service credential

// Service identifiers only — keeps the `sub`/`service_name` claims clean and
// avoids control/escape characters reaching the terminal or the token.
const SUBJECT_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/**
 * Parses `--sub <value>` and `--expires-in <days>` (also accepts `--flag=value`).
 * Strict: an unknown flag fails, so a typo'd argument can't quietly mint a token with the wrong values.
 */
function parseCliArgs(): { sub?: string; expiresIn?: string } {
  try {
    const { values } = parseArgs({
      options: {
        sub: { type: 'string' },
        'expires-in': { type: 'string' },
      },
    });
    return { sub: values.sub, expiresIn: values['expires-in'] };
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Invalid arguments');
  }
}

async function main(): Promise<void> {
  const { sub, expiresIn } = parseCliArgs();

  const config = configuration();
  const { issuer, kms } = config.billing.webhook;

  const subject = sub ?? DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT;
  if (!SUBJECT_PATTERN.test(subject)) {
    fail(
      `Invalid --sub value: ${JSON.stringify(subject)}. Allowed: letters, digits, '.', '_', '-' (max 128 chars).`,
    );
  }

  const expiresInDays = expiresIn
    ? Number.parseInt(expiresIn, 10)
    : DEFAULT_EXPIRES_IN_DAYS;
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    fail(
      `Invalid --expires-in value: ${JSON.stringify(expiresIn)}. Must be a positive number of days.`,
    );
  }

  const claimsArgs = { issuer, subject, expiresInDays };

  let token: string;
  let publicKeyPem: string | undefined;

  try {
    if (kms.keyId) {
      // KMS signing mode — the private key never leaves KMS.
      const signer = new AwsKmsSignerService({
        keyId: kms.keyId,
        webIdentityTokenFile: kms.webIdentityTokenFile,
      });
      token = await BillingAuthService.mintViaSigner(claimsArgs, (input) =>
        signer.sign(input),
      );
      // Print the matching public key so ops can set BILLING_WEBHOOK_JWT_PUBLIC_KEY.
      const spkiDer = await signer.getPublicKey();
      publicKeyPem = createPublicKey({
        key: spkiDer,
        format: 'der',
        type: 'spki',
      })
        .export({ format: 'pem', type: 'spki' })
        .toString();
    } else {
      // Local PEM signing mode — dev/CI only; production must sign via KMS.
      if (config.application.isProduction) {
        fail(
          'Production requires KMS signing: set BILLING_WEBHOOK_JWT_KMS_KEY_ID. Minting with a local BILLING_WEBHOOK_JWT_PRIVATE_KEY is not allowed in production.',
        );
      }
      const privateKey = process.env.BILLING_WEBHOOK_JWT_PRIVATE_KEY?.replace(
        /\\n/g,
        '\n',
      );
      if (!privateKey) {
        fail(
          'No signing key configured. Set BILLING_WEBHOOK_JWT_KMS_KEY_ID to sign via KMS, or BILLING_WEBHOOK_JWT_PRIVATE_KEY (ES256 EC P-256 private key, PEM) to sign locally.',
        );
      }
      token = BillingAuthService.mint({ privateKey, ...claimsArgs });
    }
  } catch (error) {
    fail(
      `Failed to mint token: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  const signedVia = kms.keyId ? `KMS (${kms.keyId})` : 'local private key';
  console.log(`
✓ Generated billing-service webhook token:

${token}

• Subject (sub): ${subject}
• Issuer & Audience (iss/aud): ${issuer}
• Algorithm: ES256
• Signed via: ${signedVia}
• Expires in: ${expiresInDays} days`);

  if (publicKeyPem) {
    console.log(`
Configure the verifier with this public key (BILLING_WEBHOOK_JWT_PUBLIC_KEY):

${publicKeyPem}`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'unknown error');
});
