import { JSONSchemaType } from 'ajv';
import { FiatCodesExchangeResult } from '../fiat-codes-exchange-result.entity';

const fiatCodesExchangeResultSchema: JSONSchemaType<FiatCodesExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    symbols: { type: 'object' },
  },
  required: ['success', 'symbols'],
};

export { fiatCodesExchangeResultSchema };
