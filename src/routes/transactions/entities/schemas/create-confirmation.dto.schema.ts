import { JSONSchemaType } from 'ajv';
import { CreateConfirmationDto } from '../create-confirmation.dto';

export const createConfirmationDtoSchema: JSONSchemaType<CreateConfirmationDto> =
  {
    $id: 'https://safe-client.safe.global/schemas/transactions/create-confirmation.dto.json',
    type: 'object',
    properties: {
      signedSafeTxHash: { type: 'string' },
    },
    required: ['signedSafeTxHash'],
  };
