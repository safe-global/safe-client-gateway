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
import { parseArgs } from 'node:util';
import configuration from '@/config/entities/configuration';
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
  const { sub, expiresIn } = parseCliArgs();

  const { issuer } = configuration().billing.webhook;
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

  console.log(`
✓ Generated billing-service webhook token:

${token}

• Subject (sub): ${subject}
• Issuer & Audience (iss/aud): ${issuer}
• Algorithm: ES256
• Expires in: ${expiresInDays} days`);
}

main();
