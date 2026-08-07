// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';

const relayRulesValidator = z
  .string()
  .refine(
    (value) => {
      if (value === undefined || value === null || value === '') return false;
      try {
        const parsed = JSON.parse(value);

        if (!Array.isArray(parsed)) return false;
        return parsed.every(
          (rule: Record<string, unknown>) =>
            typeof rule === 'object' &&
            rule !== null &&
            typeof rule.balanceMin === 'string' &&
            typeof rule.balanceMax === 'string' &&
            typeof rule.limit === 'number' &&
            BigInt(rule.balanceMin) >= 0 &&
            BigInt(rule.balanceMax) >= BigInt(rule.balanceMin) &&
            rule.limit >= 0,
        );
      } catch {
        return false;
      }
    },
    {
      error:
        'Must be a valid JSON array of objects with balances (bigint >= 0) and limit (number >= 0) properties',
    },
  )
  .optional();

function validateFieldEncryptionConfig(
  config: {
    ENCRYPTION_ENABLED?: string;
    ENCRYPTION_INDEX_KEY?: string;
    AWS_KMS_ENCRYPTION_KEY_ID?: string;
    KMS_AWS_WEB_IDENTITY_TOKEN_FILE?: string;
    KMS_AWS_ACCESS_KEY_ID?: string;
    KMS_AWS_SECRET_ACCESS_KEY?: string;
  },
  ctx: z.RefinementCtx,
): void {
  // Field encryption, when enabled, needs the blind-index key regardless
  // of environment — enabling it without the key is always broken.
  if (config.ENCRYPTION_ENABLED?.toLowerCase() !== 'true') {
    return;
  }
  for (const field of [
    'ENCRYPTION_INDEX_KEY',
    'AWS_KMS_ENCRYPTION_KEY_ID',
  ] as const) {
    if (!config[field]) {
      ctx.addIssue({
        code: 'custom',
        message: 'is required when ENCRYPTION_ENABLED is true',
        path: [field],
      });
    }
  }
  // KMS credentials come from IRSA (web identity token) or a static key
  // pair, mirroring AwsKmsService's credential resolution. Dedicated
  // KMS_AWS_* keys (like SES_AWS_*/CSV_AWS_*) so enabling field encryption
  // doesn't silently repurpose the bare AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY
  // credentials used by targeted messaging's S3 file storage, and a
  // KMS-specific web identity token file (rather than the shared
  // AWS_WEB_IDENTITY_TOKEN_FILE) so configuring IRSA for SES doesn't
  // implicitly make this client assume SES's role too.
  const hasStaticCredentials =
    !!config.KMS_AWS_ACCESS_KEY_ID && !!config.KMS_AWS_SECRET_ACCESS_KEY;
  if (!(config.KMS_AWS_WEB_IDENTITY_TOKEN_FILE || hasStaticCredentials)) {
    ctx.addIssue({
      code: 'custom',
      message:
        'AWS credentials are required when ENCRYPTION_ENABLED is true: set KMS_AWS_WEB_IDENTITY_TOKEN_FILE, or KMS_AWS_ACCESS_KEY_ID and KMS_AWS_SECRET_ACCESS_KEY',
      path: ['KMS_AWS_WEB_IDENTITY_TOKEN_FILE'],
    });
  }
}

const DomainSchema = z.string().refine(
  (val) => {
    try {
      return new URL(`https://${val}`).hostname === val;
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid domain (e.g. tenant.auth0.com)' },
);

export const RootConfigurationSchema = z
  .object({
    AUTH_TOKEN: z.string(),
    AUTH_POST_LOGIN_REDIRECT_URI: z.url(),
    AUTH_ALLOWED_REDIRECT_DOMAIN: DomainSchema.optional(),
    AUTH0_API_AUDIENCE: z.string().optional(),
    AUTH0_DOMAIN: DomainSchema.optional(),
    AUTH0_CLIENT_ID: z.string().optional(),
    BILLING_WEBHOOK_JWT_PUBLIC_KEY: z.string().optional(),
    BILLING_WEBHOOK_JWT_ISSUER: z.string().optional(),
    BILLING_WEBHOOK_JWT_KMS_KEY_ID: z.string().optional(),
    // Only consumed by scripts/generate-token.ts, never by the running app.
    // Declared here so the production guard below can see it.
    BILLING_WEBHOOK_JWT_PRIVATE_KEY: z.string().optional(),
    AUTH0_CLIENT_SECRET: z.string().optional(),
    AUTH0_REDIRECT_URI: z.url().optional(),
    AUTH0_SCOPE: z.string().optional(),
    AUTH0_JWKS_CACHE_MAX_AGE_MILLISECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .optional(),
    AUTH0_JWKS_COOLDOWN_MILLISECONDS: z.coerce.number().int().min(1).optional(),
    // Minimum 1s: the OIDC state cookie TTL is floored to whole seconds, so a
    // sub-second value would collapse to a 1s cookie and break the callback
    // state check. Fail fast on misconfiguration instead.
    AUTH_STATE_TTL_MILLISECONDS: z.coerce.number().int().min(1_000).optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_KMS_ENCRYPTION_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_SES_FROM_EMAIL: z.email().optional(),
    AWS_SES_FROM_NAME: z.string().optional(),
    AWS_WEB_IDENTITY_TOKEN_FILE: z.string().optional(),
    KMS_AWS_ACCESS_KEY_ID: z.string().optional(),
    KMS_AWS_SECRET_ACCESS_KEY: z.string().optional(),
    KMS_AWS_WEB_IDENTITY_TOKEN_FILE: z.string().optional(),
    SES_AWS_ACCESS_KEY_ID: z.string().optional(),
    SES_AWS_SECRET_ACCESS_KEY: z.string().optional(),
    FF_SES_EMAIL: z.string().optional(),
    FF_BILLING_SERVICE: z.string().optional(),
    BLOCKLIST_ENCRYPTED_DATA: z.string(),
    BLOCKLIST_SECRET_KEY: z.string(),
    BLOCKLIST_SECRET_SALT: z.string(),
    CGW_ENV: z.string().optional(),
    CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().min(1).optional(),
    CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().int().min(0).optional(),
    CIRCUIT_BREAKER_ROLLING_WINDOW: z.coerce.number().int().min(0).optional(),
    CIRCUIT_BREAKER_HALF_OPEN_FAILURE_RATE_THRESHOLD: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),
    SAFE_CONFIG_CGW_KEY: z.string().min(1).optional(),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .optional(),
    UNDICI_CONNECTIONS: z.coerce.number().int().min(1).optional(),
    UNDICI_PIPELINING: z.coerce.number().int().min(0).optional(),
    UNDICI_CONNECT_TIMEOUT_MILLISECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    UNDICI_KEEP_ALIVE_TIMEOUT_MILLISECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MILLISECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    // TODO: Reassess EMAIL_ keys after email integration
    EMAIL_API_APPLICATION_CODE: z.string(),
    EMAIL_API_FROM_EMAIL: z.email(),
    EMAIL_API_KEY: z.string(),
    EXPIRATION_DEVIATE_PERCENT: z.coerce.number().min(0).max(100).optional(),
    FINGERPRINT_ENCRYPTION_KEY: z.string(),
    INFURA_API_KEY: z.string(),
    JWT_ISSUER: z.string(),
    JWT_SECRET: z.string(),
    PUSH_NOTIFICATIONS_API_PROJECT: z.string(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL: z.email(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY: z.string(),
    PUSH_NOTIFICATIONS_API_OAUTH2_TOKEN_TTL_BUFFER_IN_SECONDS: z.coerce
      .number()
      .min(1)
      .max(3599)
      .optional(),
    RELAY_PROVIDER_API_KEY_OPTIMISM: z.string(),
    RELAY_PROVIDER_API_KEY_BSC: z.string(),
    RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: z.string(),
    RELAY_PROVIDER_API_KEY_POLYGON: z.string(),
    RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM: z.string(),
    RELAY_PROVIDER_API_KEY_BASE: z.string(),
    RELAY_PROVIDER_API_KEY_ARBITRUM_ONE: z.string(),
    RELAY_PROVIDER_API_KEY_AVALANCHE: z.string(),
    RELAY_PROVIDER_API_KEY_LINEA: z.string(),
    RELAY_PROVIDER_API_KEY_BLAST: z.string(),
    RELAY_PROVIDER_API_KEY_UNICHAIN: z.string(),
    RELAY_PROVIDER_API_KEY_SEPOLIA: z.string(),
    // Relay-fee configuration
    FEE_SERVICE_BASE_URI: z.url().optional(),
    RELAY_FEE_PREVIEW_TTL_SECONDS: z.coerce.number().int().min(0).optional(),
    // Safe billing service configuration
    SAFE_BILLING_SERVICE_BASE_URI: z.url().optional(),
    SAFE_BILLING_SERVICE_API_TOKEN: z.string().optional(),
    SAFE_BILLING_SERVICE_REQUEST_TIMEOUT_MILLISECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_SAFE_TOKEN_ADDRESS: z.string().optional(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_START_TIMESTAMP: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_END_TIMESTAMP: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_MAX_GAS_LIMIT: z.coerce
      .number()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_SEPOLIA_RELAY_RULES: relayRulesValidator,
    RELAY_NO_FEE_CAMPAIGN_MAINNET_SAFE_TOKEN_ADDRESS: z.string().optional(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_START_TIMESTAMP: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_END_TIMESTAMP: z.coerce
      .number()
      .int()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_MAX_GAS_LIMIT: z.coerce
      .number()
      .min(0)
      .optional(),
    RELAY_NO_FEE_CAMPAIGN_MAINNET_RELAY_RULES: relayRulesValidator,
    STAKING_API_KEY: z.string(),
    STAKING_TESTNET_API_KEY: z.string(),
    TARGETED_MESSAGING_FILE_STORAGE_TYPE: z.enum(['local', 'aws']).optional(),
    CSV_EXPORT_FILE_STORAGE_TYPE: z.enum(['local', 'aws']).optional(),
    SPACES_INVITE_TTL_MS: z.coerce.number().int().min(1).optional(),
    ENCRYPTION_ENABLED: z.string().optional(),
    ENCRYPTION_INDEX_KEY: z.string().optional(),
    CSV_AWS_ACCESS_KEY_ID: z.string().optional(),
    CSV_AWS_SECRET_ACCESS_KEY: z.string().optional(),
    CSV_EXPORT_QUEUE_CONCURRENCY: z.coerce.number().min(1).optional(),
    PUSH_NOTIFICATION_QUEUE_CONCURRENCY: z.coerce.number().min(1).optional(),
    EMAIL_QUEUE_CONCURRENCY: z.coerce.number().min(1).optional(),
    BLOCKAID_CLIENT_API_KEY: z.string().optional(),
    TX_SERVICE_API_KEY: z.string().trim().min(1).optional(),
    CAPTCHA_ENABLED: z.string().optional().default('false'),
    CAPTCHA_SECRET_KEY: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    // These fields are only required in deployed (production/staging) environments.
    const isDeployedEnv =
      !!config.CGW_ENV && ['production', 'staging'].includes(config.CGW_ENV);

    // The billing webhook signing key must never live in deployed environments —
    // tokens are long-lived and minted via KMS there (see scripts/generate-token.ts).
    if (isDeployedEnv && config.BILLING_WEBHOOK_JWT_PRIVATE_KEY) {
      ctx.addIssue({
        code: 'custom',
        message:
          'must not be set in production and staging environments; sign via KMS (BILLING_WEBHOOK_JWT_KMS_KEY_ID) instead',
        path: ['BILLING_WEBHOOK_JWT_PRIVATE_KEY'],
      });
    }

    // Field encryption validation runs regardless of environment: enabling it
    // without its dependencies is always broken, deployed or not.
    validateFieldEncryptionConfig(config, ctx);

    if (!isDeployedEnv) {
      return;
    }
    const isSesEnabled = config.FF_SES_EMAIL?.toLowerCase() === 'true';
    const isBillingServiceEnabled =
      config.FF_BILLING_SERVICE?.toLowerCase() === 'true';

    for (const {
      field,
      requiredWhen = true,
      message = 'is required in production and staging environments',
    } of [
      { field: 'AWS_ACCESS_KEY_ID' },
      { field: 'AWS_KMS_ENCRYPTION_KEY_ID' },
      { field: 'AWS_SECRET_ACCESS_KEY' },
      { field: 'AWS_REGION' },
      { field: 'CSV_AWS_ACCESS_KEY_ID' },
      { field: 'CSV_AWS_SECRET_ACCESS_KEY' },
      { field: 'BLOCKAID_CLIENT_API_KEY' },
      // SES permissions are set via IRSA in deployed environments, not static AWS keys.
      {
        field: 'AWS_WEB_IDENTITY_TOKEN_FILE',
        requiredWhen: isSesEnabled,
        message:
          'is required in production and staging environments when SES email is enabled',
      },
      {
        field: 'SAFE_BILLING_SERVICE_API_TOKEN',
        requiredWhen: isBillingServiceEnabled,
        message:
          'is required in production and staging environments when the billing service is enabled',
      },
      {
        field: 'SAFE_BILLING_SERVICE_BASE_URI',
        requiredWhen: isBillingServiceEnabled,
        message:
          'is required in production and staging environments when the billing service is enabled',
      },
      {
        field: 'BILLING_WEBHOOK_JWT_PUBLIC_KEY',
        requiredWhen: isBillingServiceEnabled,
        message:
          'is required in production and staging environments when the billing service is enabled',
      },
    ]) {
      if (requiredWhen && !(config as Record<string, unknown>)[field]) {
        ctx.addIssue({ code: 'custom', message, path: [field] });
      }
    }
  });

export type FileStorageType = z.infer<
  typeof RootConfigurationSchema
>['TARGETED_MESSAGING_FILE_STORAGE_TYPE'];
