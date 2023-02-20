import { JSONSchemaType } from 'ajv';
import { CreateDelegateDto } from '../create-delegate.dto.entity';

export const createDelegateDtoSchema: JSONSchemaType<CreateDelegateDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/create-delegate.dto.json',
  type: 'object',
  properties: {
    safe: { type: 'string', nullable: true },
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    signature: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'signature', 'label'],
};
