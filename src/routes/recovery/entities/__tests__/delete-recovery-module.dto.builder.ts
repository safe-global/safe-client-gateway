import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteRecoveryModuleDto } from '@/routes/recovery/entities/delete-recovery-module.dto.entity';

export function deleteRecoveryModuleDtoBuilder(): IBuilder<DeleteRecoveryModuleDto> {
  return new Builder<DeleteRecoveryModuleDto>().with(
    'moduleAddress',
    faker.finance.ethereumAddress(),
  );
}
