import { JSONSchemaType } from 'ajv';
import { CreateDelegateDto } from '../create-delegate.dto.entity';

export const CREATE_DELEGATE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/create-delegate.dto.json';

export const createDelegateDtoSchema: JSONSchemaType<CreateDelegateDto> = {
  $id: CREATE_DELEGATE_DTO_SCHEMA_ID,
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
