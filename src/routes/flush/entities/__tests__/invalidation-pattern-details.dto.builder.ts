import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { InvalidationPatternDetails } from '@/routes/flush/entities/invalidation-pattern.dto.entity';

export function invalidationPatternDetailsBuilder(): IBuilder<InvalidationPatternDetails> {
  return new Builder<InvalidationPatternDetails>().with(
    'chain_id',
    faker.string.numeric(),
  );
}
