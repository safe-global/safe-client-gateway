import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddRecoveryModuleDto } from '@/modules/recovery/routes/entities/add-recovery-module.dto.entity';

export function addRecoveryModuleDtoBuilder(): IBuilder<AddRecoveryModuleDto> {
  return new Builder<AddRecoveryModuleDto>().with(
    'moduleAddress',
    getAddress(faker.finance.ethereumAddress()),
  );
}
