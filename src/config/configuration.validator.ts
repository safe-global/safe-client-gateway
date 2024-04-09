import { ZodType } from 'zod';

/**
 * Validates the configuration against the provided schema
 *
 * @param configuration - The configuration to validate
 * @param schema - The schema to validate the configuration against
 */
export default function (
  configuration: Record<string, unknown>,
  schema: ZodType,
): Record<string, unknown> {
  if (process.env.NODE_ENV === 'test') {
    return configuration;
  }

  const result = schema.safeParse(configuration);
  if (result.success) {
    return configuration;
  }

  const errors = Object.entries(result.error.flatten().fieldErrors)
    .map(([field, errors]) => {
      if (Array.isArray(errors)) {
        return `${field} ${errors.join(', ')}`;
      }
      return `${field}: Unknown error format`;
    })
    .join('; ');

  throw Error(`Configuration is invalid: ${errors}`);
}
