import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';

export const CHAIN_UPDATE_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/chain-update.json';

export const chainUpdateEventSchema: JSONSchemaType<ChainUpdate> = {
  $id: CHAIN_UPDATE_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.CHAIN_UPDATE },
  },
  required: ['chainId', 'type'],
};
