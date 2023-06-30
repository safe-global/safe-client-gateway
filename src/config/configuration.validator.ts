import Ajv, { Schema } from 'ajv';

const configurationSchema: Schema = {
  type: 'object',
  properties: {
    AUTH_TOKEN: { type: 'string' },
    EXCHANGE_API_KEY: { type: 'string' },
    LOG_LEVEL: {
      type: 'string',
      enum: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    },
  },
  required: ['AUTH_TOKEN', 'EXCHANGE_API_KEY'],
};

export function validate(
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  if (process.env.NODE_ENV !== 'test') {
    const ajv = new Ajv({ allErrors: true });
    if (!ajv.validate(configurationSchema, configuration)) {
      const errors = ajv.errors
        ?.map((error) => `${error.instancePath} ${error.message}`)
        ?.join(', ');
      throw Error(`Configuration is invalid: ${errors}`);
    }
  }
  return configuration;
}
