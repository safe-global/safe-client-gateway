import { JSONSchemaType } from 'ajv';
import { RegisterEmailDto } from '@/routes/emails/entities/register-email.dto.entity';

export const REGISTER_EMAIL_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/emails/register-email.dto.json';

const FIVE_MINUTES_IN_MS = 5 * 60 * 1_000;

export const registerEmailDtoSchema: JSONSchemaType<RegisterEmailDto> = {
  $id: REGISTER_EMAIL_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    emailAddress: { type: 'string' },
    signature: { type: 'string' },
    timestamp: {
      type: 'number',
      minimum: Date.now() - FIVE_MINUTES_IN_MS,
      maximum: Date.now() + FIVE_MINUTES_IN_MS,
    },
  },
  required: ['emailAddress', 'signature', 'timestamp'],
};
