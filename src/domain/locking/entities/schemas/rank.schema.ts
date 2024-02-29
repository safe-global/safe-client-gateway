import { Rank } from '@/domain/locking/entities/rank.entity';
import { JSONSchemaType, Schema } from 'ajv';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const RANK_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/rank.json';

export const rankSchema: JSONSchemaType<Rank> = {
  $id: RANK_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    rank: { type: 'string' },
    lockedAmount: { type: 'string' },
  },
  required: ['address', 'rank', 'lockedAmount'],
};

export const RANK_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/rank-page.json';

export const rankPageSchema: Schema = buildPageSchema(
  RANK_PAGE_SCHEMA_ID,
  rankSchema,
);
