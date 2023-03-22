import { Schema } from 'ajv';
import { InvalidationTarget } from '../../../../domain/flush/entities/invalidation-target.entity';

export const invalidationPatternDtoSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/estimations/invalidation-pattern.dto.json',
  type: 'object',
  properties: {
    invalidate: { type: 'string', enum: Object.values(InvalidationTarget) },
    patternDetails: { type: ['object', 'null'] },
  },
  required: ['invalidate'],
};
