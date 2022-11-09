import { JSONSchemaType } from 'ajv';
import { SafeList } from '../safe-list.entity';

export const safeListSchema: JSONSchemaType<SafeList> = {
  type: 'object',
  properties: {
    safes: { type: 'array', nullable: true, items: { type: 'string' } },
  },
  required: ['safes'],
};
