import { JSONSchemaType } from 'ajv';
import { Safe } from '../safe.entity';

export const safeSchema: JSONSchemaType<Safe> = {
  $id: 'https://safe-client.safe.global/schemas/safe/safe.json',
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
