import { Schema } from 'ajv';
import { InvalidationTarget } from '../../../../domain/flush/entities/invalidation-target.entity';

export const invalidationPatternDetailSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/flush/invalidation-pattern-detail.json',
  type: 'object',
  properties: {
    chain_id: { type: ['string', 'null'] },
  },
  required: [],
};

export const invalidationPatternDtoSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/flush/invalidation-pattern.dto.json',
  type: 'object',
  properties: {
    invalidate: { type: 'string', enum: Object.values(InvalidationTarget) },
    patternDetails: {
      anyOf: [{ type: 'null' }, { $ref: 'invalidation-pattern-detail.json' }],
    },
  },
  required: ['invalidate'],
};
