import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { ContractSchema } from '@/domain/contracts/entities/schemas/contract.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('ContractSchema', () => {
  it('should validate a valid contract', () => {
    const contract = contractBuilder().build();

    const result = ContractSchema.safeParse(contract);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const contract = contractBuilder()
      .with('address', nonChecksummedAddress)
      .build();

    const result = ContractSchema.safeParse(contract);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow undefined logoUri and contractAbi', () => {
    const contract = contractBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete contract.logoUri;
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete contract.contractAbi;

    const result = ContractSchema.safeParse(contract);

    expect(result.success && result.data.logoUri).toBe(null);
    expect(result.success && result.data.contractAbi).toBe(null);
  });

  it('should not validate an invalid contract', () => {
    const contract = { invalid: 'contract' };

    const result = ContractSchema.safeParse(contract);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['address'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['displayName'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          received: 'undefined',
          path: ['trustedForDelegateCall'],
          message: 'Required',
        },
      ]),
    );
  });
});
