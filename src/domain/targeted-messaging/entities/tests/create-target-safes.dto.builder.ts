import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import type { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function createTargetedSafesDtoBuilder(): IBuilder<CreateTargetedSafesDto> {
  return new Builder<CreateTargetedSafesDto>()
    .with('outreachId', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with(
      'addresses',
      Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
        getAddress(faker.finance.ethereumAddress()),
      ),
    );
}
