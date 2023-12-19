import { JSONSchemaType } from 'ajv';
import { FiatCodes } from '../fiat-codes.entity';

export const FIAT_CODES_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/prices/fiat-codes.json';

export const fiatCodesSchema: JSONSchemaType<FiatCodes> = {
  $id: FIAT_CODES_SCHEMA_ID,
  type: 'array',
  items: { type: 'string' },
  allOf: [
    { contains: { type: 'string', enum: ['usd'] } },
    { contains: { type: 'string', enum: ['eur'] } },
  ],
  minItems: 1,
  uniqueItems: true,
};
