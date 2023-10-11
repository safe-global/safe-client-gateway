import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { Schema } from 'ajv';

export const MESSAGE_CONFIRMATION_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/messages/message-confirmation.json';

export const messageConfirmationSchema: Schema = {
  $id: MESSAGE_CONFIRMATION_SCHEMA_ID,
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

export const MESSAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/messages/message.json';

export const messageSchema: Schema = {
  $id: MESSAGE_SCHEMA_ID,
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

export const MESSAGE_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/messages/message-page.json';

export const messagePageSchema: Schema = buildPageSchema(
  MESSAGE_PAGE_SCHEMA_ID,
  messageSchema,
);
