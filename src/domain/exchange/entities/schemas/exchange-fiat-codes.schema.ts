import { JSONSchemaType } from 'ajv';
import { ExchangeFiatCodes } from '../exchange-fiat-codes.entity';

export const EXCHANGE_FIAT_CODES_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/exchange/exchange-fiat-codes.json';

export const exchangeFiatCodesSchema: JSONSchemaType<ExchangeFiatCodes> = {
  $id: EXCHANGE_FIAT_CODES_SCHEMA_ID,
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    symbols: {
      type: 'object',
      propertyNames: { type: 'string' },
      required: [],
    },
  },
  required: ['success', 'symbols'],
};
