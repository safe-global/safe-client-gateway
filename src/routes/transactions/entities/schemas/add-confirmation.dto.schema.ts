import { JSONSchemaType } from 'ajv';
import { AddConfirmationDto } from '../add-confirmation.dto';

export const ADD_CONFIRMATION_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/transactions/add-confirmation.dto.json';

export const addConfirmationDtoSchema: JSONSchemaType<AddConfirmationDto> = {
  $id: ADD_CONFIRMATION_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    signedSafeTxHash: { type: 'string' },
  },
  required: ['signedSafeTxHash'],
};
