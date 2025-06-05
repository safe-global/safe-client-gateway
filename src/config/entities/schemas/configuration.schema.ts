import { z } from 'zod';

export const RootConfigurationSchema = z
  .object({
    ACCOUNTS_ENCRYPTION_TYPE: z.enum(['local', 'aws']).optional(),
    AUTH_TOKEN: z.string(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_KMS_ENCRYPTION_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    CGW_ENV: z.string().optional(),
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .optional(),
    // TODO: Reassess EMAIL_ keys after email integration
    EMAIL_API_APPLICATION_CODE: z.string(),
    EMAIL_API_FROM_EMAIL: z.string().email(),
    EMAIL_API_KEY: z.string(),
    EMAIL_TEMPLATE_RECOVERY_TX: z.string(),
    EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: z.string(),
    EMAIL_TEMPLATE_VERIFICATION_CODE: z.string(),
    EXPIRATION_DEVIATE_PERCENT: z
      .number({ coerce: true })
      .min(0)
      .max(100)
      .optional(),
    FINGERPRINT_ENCRYPTION_KEY: z.string(),
    INFURA_API_KEY: z.string(),
    JWT_ISSUER: z.string(),
    JWT_SECRET: z.string(),
    PUSH_NOTIFICATIONS_API_PROJECT: z.string(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL: z.string().email(),
    PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY: z.string(),
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
    RELAY_PROVIDER_API_KEY_SEPOLIA: z.string(),
    STAKING_API_KEY: z.string(),
    STAKING_TESTNET_API_KEY: z.string(),
    TARGETED_MESSAGING_FILE_STORAGE_TYPE: z.enum(['local', 'aws']).optional(),
  })
  .superRefine((config, ctx) =>
    // Check for AWS_* fields in production and staging environments
    [
      'AWS_ACCESS_KEY_ID',
      'AWS_KMS_ENCRYPTION_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
    ].forEach((field) => {
      if (
        config.CGW_ENV &&
        config instanceof Object &&
        ['production', 'staging'].includes(config.CGW_ENV) &&
        !(config as Record<string, unknown>)[field]
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `is required in production and staging environments`,
          path: [field],
        });
      }
    }),
  );

export type FileStorageType = z.infer<
  typeof RootConfigurationSchema
>['TARGETED_MESSAGING_FILE_STORAGE_TYPE'];

export type AccountsEncryptionType = z.infer<
  typeof RootConfigurationSchema
>['ACCOUNTS_ENCRYPTION_TYPE'];
