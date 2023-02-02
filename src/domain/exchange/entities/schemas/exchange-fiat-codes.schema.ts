import { JSONSchemaType } from 'ajv';
import { ExchangeFiatCodes } from '../exchange-fiat-codes.entity';

export const exchangeFiatCodesSchema: JSONSchemaType<ExchangeFiatCodes> = {
  $id: 'https://safe-client.safe.global/schemas/exchange/exchange-fiat-codes.json',
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
