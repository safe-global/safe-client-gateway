import { JSONSchemaType } from 'ajv';
import { ExchangeRates } from '../exchange-rates.entity';

const exchangeRatesSchema: JSONSchemaType<ExchangeRates> = {
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

export { exchangeRatesSchema };
