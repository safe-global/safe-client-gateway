import { JSONSchemaType } from 'ajv';
import { SafeList } from '../safe-list.entity';

export const SAFE_LIST_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/safe-list.json';

export const safeListSchema: JSONSchemaType<SafeList> = {
  $id: SAFE_LIST_SCHEMA_ID,
  type: 'object',
  properties: {
    safes: { type: 'array', items: { type: 'string' } },
  },
  required: ['safes'],
};
