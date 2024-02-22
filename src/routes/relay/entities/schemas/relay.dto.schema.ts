import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { JSONSchemaType } from 'ajv';

export const RELAY_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/relay/relay.dto.json';

// TODO: Remove default when legacy support is removed
const LEGACY_SUPPORTED_VERSION = '1.3.0';

export const relayDtoSchema: JSONSchemaType<RelayDto> = {
  $id: RELAY_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    version: { type: 'string', default: LEGACY_SUPPORTED_VERSION },
    to: { type: 'string' },
    data: { type: 'string' },
    gasLimit: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
  },
  required: ['to', 'data'],
};
