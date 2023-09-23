import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { InvalidationPatternDto } from '../invalidation-pattern.dto.entity';
import { invalidationPatternDetailsBuilder } from './invalidation-pattern-details.dto.builder';

export function invalidationPatternDtoBuilder(): IBuilder<InvalidationPatternDto> {
  return Builder.new<InvalidationPatternDto>()
    .with('invalidate', faker.word.sample())
    .with('patternDetails', invalidationPatternDetailsBuilder().build());
}
