import { Schema } from 'ajv';

export const CREATE_MESSAGE_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/messages/create-message.dto.json';

export const createMessageDtoSchema: Schema = {
  $id: CREATE_MESSAGE_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    message: { type: ['object', 'string'] },
    safeAppId: { type: 'number', nullable: true },
    signature: { type: 'string' },
  },
  required: ['message', 'signature'],
};
