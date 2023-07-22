import { Schema } from 'ajv';
import { InvalidationTarget } from '../../../../domain/flush/entities/invalidation-target.entity';

export const INVALIDATION_PATTERN_DETAIL_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/flush/invalidation-pattern-detail.json';

export const invalidationPatternDetailSchema: Schema = {
  $id: INVALIDATION_PATTERN_DETAIL_SCHEMA_ID,
  type: 'object',
  properties: {
    chain_id: { type: ['string', 'null'] },
  },
  required: [],
};

export const INVALIDATION_PATTERN_DTO_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/flush/invalidation-pattern.dto.json';

export const invalidationPatternDtoSchema: Schema = {
  $id: INVALIDATION_PATTERN_DTO_SCHEMA_ID,
  type: 'object',
  properties: {
    invalidate: { type: 'string', enum: Object.values(InvalidationTarget) },
    patternDetails: {
      anyOf: [{ type: 'null' }, { $ref: 'invalidation-pattern-detail.json' }],
    },
  },
  required: ['invalidate'],
};
