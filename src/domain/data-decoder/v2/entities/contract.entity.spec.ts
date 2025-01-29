import { faker } from '@faker-js/faker';
import {
  abiBuilder,
  contractBuilder,
  projectBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import {
  AbiSchema,
  ContractSchema,
  ProjectSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';
import { getAddress } from 'viem';

describe('Contract', () => {
  describe('ProjectSchema', () => {
    it('should validate a Project', () => {
      const project = projectBuilder().build();

      const result = ProjectSchema.safeParse(project);

      expect(result.success).toBe(true);
    });

    it('should require a valid URL for logo_file', () => {
      const project = projectBuilder()
        .with('logo_file', faker.string.numeric())
        .build();

      const result = ProjectSchema.safeParse(project);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_string',
          message: 'Invalid url',
          path: ['logo_file'],
          validation: 'url',
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
          message: 'Required',
          path: ['description'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['logo_file'],
          received: 'undefined',
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

    it('should expect an array of objects for abi_json', () => {
      const abi = abiBuilder()
        .with('abi_json', [
          faker.string.numeric() as unknown as Record<string, unknown>,
        ])
        .build();

      const result = AbiSchema.safeParse(abi);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Expected object, received string',
          path: ['abi_json', 0],
          received: 'string',
        },
      ]);
    });

    it('should require a valid hex string for abi_hash', () => {
      const abi = abiBuilder()
        .with('abi_hash', faker.string.numeric() as `0x${string}`)
        .build();

      const result = AbiSchema.safeParse(abi);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['abi_hash'],
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
          message: 'Required',
          path: ['abi_json'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['abi_hash'],
          received: 'undefined',
        },
        {
          code: 'invalid_date',
          message: 'Invalid date',
          path: ['modified'],
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
        .with('address', nonChecksummedAddress as `0x${string}`)
        .build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success && result.data.address).toStrictEqual(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should expect a numeric chain_id, coercing it to a string', () => {
      const chainId = faker.number.int();
      const contract = contractBuilder()
        .with('chain_id', chainId as unknown as `${number}`)
        .build();

      const result = ContractSchema.safeParse(contract);

      expect(result.success && result.data.chain_id).toBe(`${chainId}`);
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
          message: 'Required',
          path: ['address'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['display_name'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Required',
          path: ['chain_id'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['project'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['abi'],
          received: 'undefined',
        },
        {
          code: 'invalid_date',
          message: 'Invalid date',
          path: ['modified'],
        },
      ]);
    });
  });
});
