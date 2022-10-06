import { JSONSchemaType } from 'ajv';
import { ExchangeFiatCodes } from '../exchange-fiat-codes.entity';

const exchangeFiatCodesSchema: JSONSchemaType<ExchangeFiatCodes> = {
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

export { exchangeFiatCodesSchema };
