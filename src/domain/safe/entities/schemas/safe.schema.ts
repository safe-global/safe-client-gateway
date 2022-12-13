import { JSONSchemaType } from 'ajv';
import { Safe } from '../safe.entity';

export const safeSchema: JSONSchemaType<Safe> = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    nonce: { type: 'number' },
    threshold: { type: 'number' },
    owners: { type: 'array', items: { type: 'string' } },
    masterCopy: { type: 'string' },
    modules: {
      type: 'array',
      nullable: true,
      default: null,
      items: { type: 'string' },
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
