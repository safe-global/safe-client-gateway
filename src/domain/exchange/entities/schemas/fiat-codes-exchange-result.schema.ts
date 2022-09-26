import { JSONSchemaType } from 'ajv';
import { FiatCodesExchangeResult } from '../fiat-codes-result.entity';

const fiatCodesExchangeResultSchema: JSONSchemaType<FiatCodesExchangeResult> = {
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

export { fiatCodesExchangeResultSchema };
