import { addRecoveryModuleDtoBuilder } from '@/routes/recovery/entities/__tests__/add-recovery-module.dto.builder';
import { AddRecoveryModuleDtoSchema } from '@/routes/recovery/entities/schemas/add-recovery-module.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('AddRecoveryModuleDtoSchema', () => {
  it('should validate a valid AddRecoveryModuleDto', () => {
    const addRecoveryModuleDto = addRecoveryModuleDtoBuilder().build();

    const result = AddRecoveryModuleDtoSchema.safeParse(addRecoveryModuleDto);

    expect(result.success).toBe(true);
  });

  it('should checksum the moduleAddress', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
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

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['moduleAddress'],
          message: 'Required',
        },
      ]),
    );
  });
});
