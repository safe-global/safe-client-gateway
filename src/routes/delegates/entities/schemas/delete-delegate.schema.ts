import { JSONSchemaType } from 'ajv';
import { DeleteDelegateDto } from '../delete-delegate.entity';

export const deleteDelegateDtoSchema: JSONSchemaType<DeleteDelegateDto> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/delete-delegate.json',
  type: 'object',
  properties: {
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    signature: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'signature'],
};
