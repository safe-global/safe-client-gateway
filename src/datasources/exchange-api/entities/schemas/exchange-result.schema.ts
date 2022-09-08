import { JSONSchemaType } from 'ajv';
import { ExchangeResult } from '../../../../domain/exchange/entities/exchange-result.entity';

const exchangeResultSchema: JSONSchemaType<ExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    rates: { type: 'object', nullable: true },
    base: { type: 'string' },
  },
  required: ['success', 'base'],
};

export { exchangeResultSchema };
