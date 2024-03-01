import { RelayLegacyDto } from '@/routes/relay/entities/relay.legacy.dto.entity';
import { JSONSchemaType } from 'ajv';

export const RELAY_LEGACY_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/relay/relay.legacy.dto.json';

export const relayLegacyDtoSchema: JSONSchemaType<RelayLegacyDto> = {
  $id: RELAY_LEGACY_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    chainId: { type: 'string' },
    to: { type: 'string' },
    data: { type: 'string' },
    gasLimit: { oneOf: [{ type: 'string' }, { type: 'null', nullable: true }] },
  },
  required: ['chainId', 'to', 'data'],
};
