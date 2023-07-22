import { JSONSchemaType } from 'ajv';
import { DeleteSafeDelegateDto } from '../delete-safe-delegate.dto.entity';

export const DELETE_SAFE_DELEGATE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/delegates/delete-safe-delegate.dto.json';

export const deleteSafeDelegateDtoSchema: JSONSchemaType<DeleteSafeDelegateDto> =
  {
    $id: DELETE_SAFE_DELEGATE_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      delegate: { type: 'string' },
      safe: { type: 'string' },
      signature: { type: 'string' },
    },
    required: ['delegate', 'safe', 'signature'],
  };
