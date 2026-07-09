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
 *     For dev/CI only; rejected when CGW_ENV is production or staging (KMS is
 *     required there).
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
import { DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT } from '@/modules/billing/domain/billing-auth.constants';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';

const DEFAULT_EXPIRES_IN_DAYS = 5 * 365; // ~5 years, long-lived service credential

// Service identifiers only — keeps the `sub`/`service_name` claims clean and
// avoids control/escape characters reaching the terminal or the token.
const SUBJECT_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

type ClaimsArgs = {
  issuer: string;
  subject: string;
  expiresInDays: number;
};

type MintResult = {
  token: string;
  /** Only set for KMS mode, where the caller can't derive it from local env. */
  publicKeyPem?: string;
};

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

function resolveSubject(sub?: string): string {
  const subject = sub ?? DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT;
  if (!SUBJECT_PATTERN.test(subject)) {
    fail(
      `Invalid --sub value: ${JSON.stringify(subject)}. Allowed: letters, digits, '.', '_', '-' (max 128 chars).`,
    );
  }
  return subject;
}

function resolveExpiresInDays(expiresIn?: string): number {
  const expiresInDays = expiresIn
    ? Number.parseInt(expiresIn, 10)
    : DEFAULT_EXPIRES_IN_DAYS;
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    fail(
      `Invalid --expires-in value: ${JSON.stringify(expiresIn)}. Must be a positive number of days.`,
    );
  }
  return expiresInDays;
}

/** KMS signing mode — the private key never leaves KMS. */
async function mintViaKms(
  kms: { keyId: string; webIdentityTokenFile?: string },
  claimsArgs: ClaimsArgs,
): Promise<MintResult> {
  const signer = new AwsKmsSignerService({
    keyId: kms.keyId,
    webIdentityTokenFile: kms.webIdentityTokenFile,
  });
  const token = await BillingAuthService.mintViaSigner(claimsArgs, (input) =>
    signer.sign(input),
  );
  // Return the matching public key so ops can set BILLING_WEBHOOK_JWT_PUBLIC_KEY.
  const spkiDer = await signer.getPublicKey();
  const publicKeyPem = createPublicKey({
    key: spkiDer,
    format: 'der',
    type: 'spki',
  })
    .export({ format: 'pem', type: 'spki' })
    .toString();
  return { token, publicKeyPem };
}

/** Local PEM signing mode — dev/CI only; deployed environments must sign via KMS. */
function mintViaLocalKey(claimsArgs: ClaimsArgs): MintResult {
  // Mirrors the RootConfigurationSchema guard, which rejects
  // BILLING_WEBHOOK_JWT_PRIVATE_KEY in these environments at app startup.
  const isDeployedEnv = ['production', 'staging'].includes(
    process.env.CGW_ENV ?? '',
  );
  if (isDeployedEnv) {
    fail(
      'Production and staging require KMS signing: set BILLING_WEBHOOK_JWT_KMS_KEY_ID. Minting with a local BILLING_WEBHOOK_JWT_PRIVATE_KEY is not allowed in these environments.',
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
  return { token: BillingAuthService.mint({ privateKey, ...claimsArgs }) };
}

function printResult(args: {
  result: MintResult;
  claimsArgs: ClaimsArgs;
  signedVia: string;
}): void {
  const { result, claimsArgs, signedVia } = args;
  console.log(`
✓ Generated billing-service webhook token:

${result.token}

• Subject (sub): ${claimsArgs.subject}
• Issuer & Audience (iss/aud): ${claimsArgs.issuer}
• Algorithm: ES256
• Signed via: ${signedVia}
• Expires in: ${claimsArgs.expiresInDays} days`);

  if (result.publicKeyPem) {
    console.log(`
Configure the verifier with this public key (BILLING_WEBHOOK_JWT_PUBLIC_KEY):

${result.publicKeyPem}`);
  }
}

async function main(): Promise<void> {
  const { sub, expiresIn } = parseCliArgs();

  const config = configuration();
  const { issuer, kms } = config.billing.webhook;

  const claimsArgs: ClaimsArgs = {
    issuer,
    subject: resolveSubject(sub),
    expiresInDays: resolveExpiresInDays(expiresIn),
  };

  let result: MintResult;
  try {
    result = kms.keyId
      ? await mintViaKms({ ...kms, keyId: kms.keyId }, claimsArgs)
      : mintViaLocalKey(claimsArgs);
  } catch (error) {
    fail(
      `Failed to mint token: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  printResult({
    result,
    claimsArgs,
    signedVia: kms.keyId ? `KMS (${kms.keyId})` : 'local private key',
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'unknown error');
});
