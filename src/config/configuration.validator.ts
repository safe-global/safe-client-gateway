import Ajv, { Schema } from 'ajv';

const configurationSchema: Schema = {
  type: 'object',
  properties: {
    AUTH_TOKEN: { type: 'string' },
    EXCHANGE_API_KEY: { type: 'string' },
  },
  required: ['AUTH_TOKEN', 'EXCHANGE_API_KEY'],
};

export function validate(
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  if (process.env.NODE_ENV !== 'test') {
    const ajv = new Ajv({ allErrors: true });
    if (!ajv.validate(configurationSchema, configuration)) {
      const errors = ajv.errors?.reduce((acc, e) => [...acc, e.message], []);
      throw Error(`Mandatory configuration is missing: ${errors?.join(', ')}`);
    }
  }
  return configuration;
}
