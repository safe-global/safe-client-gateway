import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { InvalidationPatternDetails } from '../invalidation-pattern.dto.entity';

export function invalidationPatternDetailsBuilder(): IBuilder<InvalidationPatternDetails> {
  return Builder.new<InvalidationPatternDetails>().with(
    'chain_id',
    faker.string.numeric(),
  );
}
