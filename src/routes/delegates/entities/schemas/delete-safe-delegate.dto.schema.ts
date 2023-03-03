import { JSONSchemaType } from 'ajv';
import { DeleteSafeDelegateDto } from '../delete-safe-delegate.dto.entity';

export const deleteSafeDelegateDtoSchema: JSONSchemaType<DeleteSafeDelegateDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/delegates/delete-safe-delegate.dto.json',
    type: 'object',
    properties: {
      delegate: { type: 'string' },
      safe: { type: 'string' },
      signature: { type: 'string' },
    },
    required: ['delegate', 'safe', 'signature'],
  };
