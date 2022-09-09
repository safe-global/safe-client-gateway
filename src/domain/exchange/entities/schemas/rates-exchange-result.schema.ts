import { JSONSchemaType } from 'ajv';
import { RatesExchangeResult } from '../rates-exchange-result.entity';

const ratesExchangeResultSchema: JSONSchemaType<RatesExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    rates: { type: 'object' },
    base: { type: 'string' },
  },
  required: ['success', 'base', 'rates'],
};

export { ratesExchangeResultSchema };
