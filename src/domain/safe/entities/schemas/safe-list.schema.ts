import { JSONSchemaType } from 'ajv';
import { SafeList } from '../safe-list.entity';

export const safeListSchema: JSONSchemaType<SafeList> = {
  $id: 'https://safe-client.safe.global/schemas/safe/safe-list.json',
  type: 'object',
  properties: {
    safes: { type: 'array', items: { type: 'string' } },
  },
  required: ['safes'],
};
