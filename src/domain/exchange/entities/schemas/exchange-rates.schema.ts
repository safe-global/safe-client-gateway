import { JSONSchemaType } from 'ajv';
import { ExchangeRates } from '../exchange-rates.entity';

export const exchangeRatesSchema: JSONSchemaType<ExchangeRates> = {
  $id: 'https://safe-client.safe.global/schemas/exchange/exchange-rates.json',
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
