import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { JSONSchemaType } from 'ajv';

export const RELAY_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/relay/relay.dto.json';

export const relayDtoSchema: JSONSchemaType<RelayDto> = {
  $id: RELAY_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    to: { type: 'string' },
    data: { type: 'string' },
    gasLimit: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
  },
  required: ['to', 'data'],
};
