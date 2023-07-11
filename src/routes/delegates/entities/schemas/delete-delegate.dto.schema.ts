import { JSONSchemaType } from 'ajv';
import { DeleteDelegateDto } from '../delete-delegate.dto.entity';

export const DELETE_DELEGATE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/delete-delegate.dto.json';

export const deleteDelegateDtoSchema: JSONSchemaType<DeleteDelegateDto> = {
  $id: DELETE_DELEGATE_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    signature: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'signature'],
};
