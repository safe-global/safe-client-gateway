import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';

export const SAFE_APPS_UPDATE_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/safe-apps-update.json';

export const safeAppsUpdateEventSchema: JSONSchemaType<SafeAppsUpdate> = {
  $id: SAFE_APPS_UPDATE_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.SAFE_APPS_UPDATE },
  },
  required: ['chainId', 'type'],
};
