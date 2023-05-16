import { JSONSchemaType } from 'ajv';
import { AddConfirmationDto } from '../add-confirmation.dto';

export const addConfirmationDtoSchema: JSONSchemaType<AddConfirmationDto> = {
  $id: 'https://safe-client.safe.global/schemas/transactions/add-confirmation.dto.json',
  type: 'object',
  properties: {
    signedSafeTxHash: { type: 'string' },
  },
  required: ['signedSafeTxHash'],
};
