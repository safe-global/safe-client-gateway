import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddRecoveryModuleDto } from '@/routes/recovery/entities/add-recovery-module.dto.entity';
import { getAddress } from 'viem';

export function addRecoveryModuleDtoBuilder(): IBuilder<AddRecoveryModuleDto> {
  return new Builder<AddRecoveryModuleDto>().with(
    'moduleAddress',
    getAddress(faker.finance.ethereumAddress()),
  );
}
