import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { InvalidationPatternDto } from '../invalidation-pattern.dto.entity';

export function invalidationPatternDtoBuilder(): IBuilder<InvalidationPatternDto> {
  return Builder.new<InvalidationPatternDto>()
    .with('invalidate', faker.random.word())
    .with('patternDetails', { chain_id: faker.random.numeric() });
}
