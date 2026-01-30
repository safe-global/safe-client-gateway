import { faker } from '@faker-js/faker';
import {
  abiBuilder,
  contractBuilder,
  projectBuilder,
} from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import {
  AbiSchema,
  ContractSchema,
  ProjectSchema,
} from '@/modules/data-decoder/domain/v2/entities/contract.entity';
import { type Address, getAddress } from 'viem';

describe('Contract', () => {
  describe('ProjectSchema', () => {
    it('should validate a Project', () => {
      const project = projectBuilder().build();

      const result = ProjectSchema.safeParse(project);

      expect(result.success).toBe(true);
    });

    it('should require a valid URL for logoFile', () => {
      const project = projectBuilder()
        .with('logoFile', faker.string.numeric())
        .build();

      const result = ProjectSchema.safeParse(project);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_format',
          format: 'url',
          message: 'Invalid URL',
          path: ['logoFile'],
        },
      ]);
    });

    it('should not validate an invalid Project', () => {
      const project = { invalid: 'project' };

      const result = ProjectSchema.safeParse(project);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['description'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['logoFile'],
        },
      ]);
    });
  });

  describe('AbiSchema', () => {
    it('should validate an Abi', () => {
      const abi = abiBuilder().build();

      const result = AbiSchema.safeParse(abi);

      expect(result.success).toBe(true);
    });

    it('should expect an array of objects for abiJson', () => {
      const abi = abiBuilder()
        .with('abiJson', [
          faker.string.numeric() as unknown as Record<string, unknown>,
        ])
        .build();

      const result = AbiSchema.safeParse(abi);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'record',
          message: 'Invalid input: expected record, received string',
          path: ['abiJson', 0],
        },
      ]);
    });

    it('should require a valid hex string for abiHash', () => {
      const abi = abiBuilder()
        .with('abiHash', faker.string.numeric() as Address)
        .build();

      const result = AbiSchema.safeParse(abi);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['abiHash'],
        },
      ]);
    });

    it('should coerce modified to date', () => {
      const date = faker.date.past();
      const abi = abiBuilder()
        .with('modified', date.toISOString() as unknown as Date)
        .build();

      const result = AbiSchema.safeParse(abi);

      expect(result.success && result.data.modified).toStrictEqual(date);
    });

    it('should not validate an invalid Abi', () => {
      const abi = { invalid: 'abi' };

      const result = AbiSchema.safeParse(abi);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'array',
          message: 'Invalid input: expected array, received undefined',
          path: ['abiJson'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received undefined',
          path: ['abiHash'],
        },
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received Date',
          path: ['modified'],
          received: 'Invalid Date',
        },
      ]);
    });
  });

  describe('ContractSchema', () => {
    it('should validate a Contract', () => {
      const contract = contractBuilder().build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success).toBe(true);
    });

    it('should checksum the address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const contract = contractBuilder()
        .with('address', nonChecksummedAddress as Address)
        .build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success && result.data.address).toStrictEqual(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should expect a numeric chainId, coercing it to a string', () => {
      const chainId = faker.number.int();
      const contract = contractBuilder()
        .with('chainId', chainId as unknown as `${number}`)
        .build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success && result.data.chainId).toBe(`${chainId}`);
    });

    it('should coerce modified to date', () => {
      const date = faker.date.past();
      const contract = contractBuilder()
        .with('modified', date.toISOString() as unknown as Date)
        .build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success && result.data.modified).toStrictEqual(date);
    });

    it('should not validate an invalid Contract', () => {
      const contract = { invalid: 'contract' };

      const result = ContractSchema.safeParse(contract);

      expect(!result.success && result.error.issues).toStrictEqual([
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
          expected: 'number',
          message: 'Invalid input: expected number, received undefined',
          path: ['chainId'],
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received undefined',
          path: ['project'],
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received undefined',
          path: ['abi'],
        },
        {
          code: 'invalid_type',
          expected: 'date',
          message: 'Invalid input: expected date, received Date',
          path: ['modified'],
          received: 'Invalid Date',
        },
        {
          code: 'invalid_type',
          expected: 'boolean',
          message: 'Invalid input: expected boolean, received undefined',
          path: ['trustedForDelegateCall'],
        },
      ]);
    });

    it('should default name to empty string', () => {
      const contract = { ...contractBuilder().build(), name: null };

      const result = ContractSchema.safeParse(contract);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('');
    });

    it('should default displayName to empty string', () => {
      const contract = { ...contractBuilder().build(), displayName: null };

      const result = ContractSchema.safeParse(contract);

      expect(result.success).toBe(true);
      expect(result.data?.displayName).toBe('');
    });
  });
});
