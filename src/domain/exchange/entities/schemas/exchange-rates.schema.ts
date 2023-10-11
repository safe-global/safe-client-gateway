import { JSONSchemaType } from 'ajv';
import { ExchangeRates } from '@/domain/exchange/entities/exchange-rates.entity';

export const EXCHANGE_RATES_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/exchange/exchange-rates.json';

export const exchangeRatesSchema: JSONSchemaType<ExchangeRates> = {
  $id: EXCHANGE_RATES_SCHEMA_ID,
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
