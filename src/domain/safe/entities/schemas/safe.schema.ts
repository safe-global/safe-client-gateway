import { Schema } from 'ajv';

export const SAFE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/safe.json';

export const safeSchema: Schema = {
  $id: SAFE_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    nonce: { type: 'number' },
    threshold: { type: 'number' },
    owners: { type: 'array', items: { type: 'string' } },
    masterCopy: { type: 'string' },
    modules: {
      oneOf: [
        { type: 'array', items: { type: 'string' } },
        { type: 'null', nullable: true },
      ],
      default: null,
    },
    fallbackHandler: { type: 'string' },
    guard: { type: 'string' },
    version: { type: 'string', nullable: true, default: null },
  },
  required: [
    'address',
    'nonce',
    'threshold',
    'owners',
    'masterCopy',
    'fallbackHandler',
    'guard',
  ],
};
