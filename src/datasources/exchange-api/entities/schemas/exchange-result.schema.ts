import Ajv, { JSONSchemaType } from 'ajv';
import { ExchangeResult } from '../exchange-result.entity';

const ajv = new Ajv();

const exchangeResultSchema: JSONSchemaType<ExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    rates: { type: 'object', nullable: true },
    base: { type: 'string' },
  },
  required: [],
};

const isValidExchangeResult = ajv.compile(exchangeResultSchema);

export default isValidExchangeResult;
