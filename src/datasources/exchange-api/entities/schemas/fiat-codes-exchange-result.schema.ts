import Ajv, { JSONSchemaType } from 'ajv';
import { FiatCodesExchangeResult } from '../fiat-codes-result.entity';

const ajv = new Ajv();

const fiatCodesExchangeResultSchema: JSONSchemaType<FiatCodesExchangeResult> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    symbols: { type: 'object', nullable: true },
  },
  required: [],
};

const isValidFiatCodesExchangeResult = ajv.compile(
  fiatCodesExchangeResultSchema,
);

export default isValidFiatCodesExchangeResult;
