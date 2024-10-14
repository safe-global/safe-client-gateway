import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { IndexingStatus } from '@/domain/indexing/entities/indexing-status.entity';
import { faker } from '@faker-js/faker';

export function indexingStatusBuilder(): IBuilder<IndexingStatus> {
  return new Builder<IndexingStatus>()
    .with('currentBlockNumber', faker.number.int())
    .with('currentBlockTimestamp', faker.date.recent())
    .with('erc20BlockNumber', faker.number.int())
    .with('erc20BlockTimestamp', faker.date.recent())
    .with('erc20Synced', faker.datatype.boolean())
    .with('masterCopiesBlockNumber', faker.number.int())
    .with('masterCopiesBlockTimestamp', faker.date.recent())
    .with('masterCopiesSynced', faker.datatype.boolean())
    .with('synced', faker.datatype.boolean());
}
