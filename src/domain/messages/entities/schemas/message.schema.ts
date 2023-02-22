import { Schema } from 'ajv';

export const messageConfirmationSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/messages/message-confirmation.json',
  type: 'object',
  properties: {
    created: { type: 'string', isDate: true },
    modified: { type: 'string', isDate: true },
    owner: { type: 'string' },
    signature: { type: 'string' },
    signatureType: { type: 'string' },
  },
  required: ['created', 'modified', 'owner', 'signature', 'signatureType'],
};

export const messageSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/messages/message.json',
  type: 'object',
  properties: {
    created: { type: 'string', isDate: true },
    modified: { type: 'string', isDate: true },
    safe: { type: 'string' },
    messageHash: { type: 'string' },
    message: { type: ['object', 'string'] },
    proposedBy: { type: 'string' },
    safeAppId: { type: 'number', nullable: true },
    confirmations: {
      type: 'array',
      items: { $ref: 'message-confirmation.json' },
    },
    preparedSignature: { type: 'string', nullable: true },
  },
  required: [
    'created',
    'modified',
    'safe',
    'messageHash',
    'message',
    'proposedBy',
    'confirmations',
  ],
};
