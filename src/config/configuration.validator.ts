import { z } from 'zod';

const ConfigurationSchema = z.object({
  AUTH_TOKEN: z.string(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .optional(),
  ALERTS_PROVIDER_SIGNING_KEY: z.string(),
  ALERTS_PROVIDER_API_KEY: z.string(),
  ALERTS_PROVIDER_ACCOUNT: z.string(),
  ALERTS_PROVIDER_PROJECT: z.string(),
  EMAIL_API_APPLICATION_CODE: z.string(),
  EMAIL_API_FROM_EMAIL: z.string().email(),
  EMAIL_API_KEY: z.string(),
  EMAIL_TEMPLATE_RECOVERY_TX: z.string(),
  EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX: z.string(),
  EMAIL_TEMPLATE_VERIFICATION_CODE: z.string(),
  JWT_SECRET: z.string(),
  RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN: z.string(),
  RELAY_PROVIDER_API_KEY_SEPOLIA: z.string(),
});

export function validate(
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  if (process.env.NODE_ENV === 'test') {
    return configuration;
  }

  const result = ConfigurationSchema.safeParse(configuration);
  if (result.success) {
    return configuration;
  }

  const { fieldErrors } = result.error.flatten();

  const errors = Object.entries(fieldErrors)
    .reduce<Array<string>>((acc, [key, [error]]) => {
      return [...acc, `${key} ${error}`];
    }, [])
    .join(', ');

  throw Error(`Configuration is invalid: ${errors}`);
}
