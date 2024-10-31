import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function targetedSafeBuilder(): IBuilder<TargetedSafe> {
  return new Builder<TargetedSafe>()
    .with('id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('outreachId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
