import { JSONSchemaType } from 'ajv';
import { Safe } from '@/domain/safe/entities/safe.entity';

export const SAFE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/safe.json';

export const safeSchema: JSONSchemaType<Safe> = {
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
    version: { type: 'string' },
  },
  required: [
    'address',
    'nonce',
    'threshold',
    'owners',
    'masterCopy',
    'fallbackHandler',
    'guard',
    'version',
  ],
};
