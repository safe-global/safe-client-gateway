import { JSONSchemaType } from 'ajv';
import { Delegate } from '@/domain/delegate/entities/delegate.entity';

export const DELEGATE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/delegate.json';

export const delegateSchema: JSONSchemaType<Delegate> = {
  $id: DELEGATE_SCHEMA_ID,
  type: 'object',
  properties: {
    safe: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'label'],
};
