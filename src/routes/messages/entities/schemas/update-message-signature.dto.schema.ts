import { JSONSchemaType } from 'ajv';
import { UpdateMessageSignatureDto } from '../update-message-signature.entity';

export const updateMessageSignatureDtoSchema: JSONSchemaType<UpdateMessageSignatureDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/messages/update-message-signature.dto.json',
    type: 'object',
    properties: {
      signature: { type: 'string' },
    },
    required: ['signature'],
  };
