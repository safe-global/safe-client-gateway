import { Schema } from 'ajv';

export const createMessageDtoSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/messages/create-message.dto.json',
  type: 'object',
  properties: {
    message: { type: ['object', 'string'] },
    safeAppId: { type: 'number', nullable: true },
    signature: { type: 'string' },
  },
  required: ['message', 'signature'],
};
