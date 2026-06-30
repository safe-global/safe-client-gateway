// SPDX-License-Identifier: FSL-1.1-MIT
// biome-ignore-all lint/suspicious/noConsole: CLI script — console is the intended output.

/**
 * Mints the long-lived ES256 service-to-service token that the billing service
 * presents on each webhook call to the CGW (`Authorization: Bearer <token>`).
 *
 * The CGW is the receiver that issues the credential it later verifies: this
 * script signs with the CGW's private key, and the running app verifies
 * incoming tokens with the matching public key (BILLING_WEBHOOK_JWT_PUBLIC_KEY).
 * The private key lives only here, never in the running app's config.
 *
 * Usage:
 *   BILLING_WEBHOOK_JWT_PRIVATE_KEY="$(cat ec-priv.pem)" \
 *     yarn generate-token --sub billing-service --expires-in 1825
 *
 * Environment:
 *   BILLING_WEBHOOK_JWT_PRIVATE_KEY  ES256 (EC P-256) private key in PEM (required)
 *   BILLING_WEBHOOK_JWT_ISSUER       the CGW identifier, used as iss and aud
 *                                    (default: safe-client-gateway)
 *
 * The issuer is resolved from the app config, so it matches what the webhook
 * guard verifies against.
 *
 * See src/modules/billing/README.md for the full usage and provisioning guide.
 */
import configuration from '@/config/entities/configuration';
import {
  BillingAuthService,
  DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT,
} from '@/modules/billing/domain/billing-auth.service';

const DEFAULT_EXPIRES_IN_DAYS = 5 * 365; // ~5 years, long-lived service credential

/**
 * Reads a `--flag value` style argument from process.argv.
 */
function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function main(): void {
  const privateKey = process.env.BILLING_WEBHOOK_JWT_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  );
  if (!privateKey) {
    fail(
      'BILLING_WEBHOOK_JWT_PRIVATE_KEY environment variable is not defined (ES256 EC P-256 private key, PEM).',
    );
  }

  // Resolve the issuer the same way the verifying app does (env or default),
  // so a minted token always matches what the guard verifies.
  const { issuer } = configuration().billing.webhook;
  const subject = getArg('sub') ?? DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT;

  const expiresInArg = getArg('expires-in');
  const expiresInDays = expiresInArg
    ? Number.parseInt(expiresInArg, 10)
    : DEFAULT_EXPIRES_IN_DAYS;
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    fail(
      `Invalid --expires-in value: ${expiresInArg}. Must be a positive number of days.`,
    );
  }

  let token: string;
  try {
    token = BillingAuthService.mint({
      privateKey,
      issuer,
      subject,
      expiresInDays,
    });
  } catch (error) {
    fail(
      `Failed to mint token: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  console.log('\n✓ Generated billing-service webhook token:');
  console.log(`\n${token}`);
  console.log(`\n• Subject (sub): ${subject}`);
  console.log(`• Issuer & Audience (iss/aud): ${issuer}`);
  console.log(`• Algorithm: ES256`);
  console.log(`• Expires in: ${expiresInDays} days`);
}

main();
