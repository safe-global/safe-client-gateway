import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { invalidationPatternDetailsBuilder } from '@/routes/flush/entities/__tests__/invalidation-pattern-details.dto.builder';
import { InvalidationPatternDto } from '@/routes/flush/entities/invalidation-pattern.dto.entity';

export function invalidationPatternDtoBuilder(): IBuilder<InvalidationPatternDto> {
  return Builder.new<InvalidationPatternDto>()
    .with('invalidate', faker.word.sample())
    .with('patternDetails', invalidationPatternDetailsBuilder().build());
}
