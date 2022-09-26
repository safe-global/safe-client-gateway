import { JSONSchemaType } from 'ajv';
import { ExchangeResult } from '../exchange-result.entity';

const exchangeResultSchema: JSONSchemaType<ExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    rates: {
      type: 'object',
      propertyNames: { type: 'string' },
      required: [],
    },
    base: { type: 'string' },
  },
  required: ['success', 'base', 'rates'],
};

export { exchangeResultSchema };
