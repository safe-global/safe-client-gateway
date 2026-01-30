import { contractBuilder } from '@/modules/contracts/domain/entities/__tests__/contract.builder';
import { ContractSchema } from '@/modules/contracts/domain/entities/schemas/contract.schema';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

describe('ContractSchema', () => {
  it('should validate a valid contract', () => {
    const contract = contractBuilder().build();

    const result = ContractSchema.safeParse(contract);

    expect(result.success).toBe(true);
  });

  it('should checksum the address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as Address;
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

    expect(!result.success && result.error.issues).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['address'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['name'],
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['displayName'],
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['trustedForDelegateCall'],
      },
    ]);
  });
});
