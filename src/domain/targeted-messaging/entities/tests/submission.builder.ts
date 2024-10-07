import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function submissionBuilder(): IBuilder<Submission> {
  return new Builder<Submission>()
    .with('id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('outreachId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('targetedSafeId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('signerAddress', getAddress(faker.finance.ethereumAddress()))
    .with('completionDate', faker.date.recent())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
