import { addRecoveryModuleDtoBuilder } from '@/modules/recovery/routes/entities/__tests__/add-recovery-module.dto.builder';
import { AddRecoveryModuleDtoSchema } from '@/modules/recovery/routes/entities/schemas/add-recovery-module.dto.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('AddRecoveryModuleDtoSchema', () => {
  it('should validate a valid AddRecoveryModuleDto', () => {
    const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();

    const result = AddRecoveryModuleDtoSchema.safeParse(addRecoveryModuleDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the moduleAddress', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
    const addRecoveryModuleDto = addRecoveryModuleDtoBuilder()
      .with('moduleAddress', nonChecksummedAddress)
      .build();

    const result = AddRecoveryModuleDtoSchema.safeParse(addRecoveryModuleDto);

    expect(result.success && result.data.moduleAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow moduleAddress to be undefined', () => {
    const result = AddRecoveryModuleDtoSchema.safeParse({});

    expect(!result.success && result.error.issues).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['moduleAddress'],
      },
    ]);
  });
});
