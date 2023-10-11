import { JSONSchemaType } from 'ajv';
import { UpdateMessageSignatureDto } from '@/routes/messages/entities/update-message-signature.entity';

export const UPDATE_MESSAGE_SIGNATURE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/messages/update-message-signature.dto.json';

export const updateMessageSignatureDtoSchema: JSONSchemaType<UpdateMessageSignatureDto> =
  {
    $id: UPDATE_MESSAGE_SIGNATURE_DTO_SCHEMA_ID,
    type: 'object',
    properties: {
      signature: { type: 'string' },
    },
    required: ['signature'],
  };
