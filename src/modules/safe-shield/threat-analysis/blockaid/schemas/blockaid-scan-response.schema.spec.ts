import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { BlockaidScanResponseSchema } from './blockaid-scan-response.schema';

describe('BlockaidScanResponseSchema', () => {
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  it('parses a full response with validation and simulation data', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: faker.helpers.arrayElement(['Warning', 'Malicious']),
        reason: faker.lorem.words(2),
        classification: faker.lorem.word(),
        description: faker.lorem.sentence(),
        features: [
          {
            type: faker.helpers.arrayElement(['Malicious', 'Warning']),
            description: faker.lorem.sentence(),
            address: safeAddress,
          },
        ],
      },
      simulation: {
        status: 'Success',
        description: faker.lorem.sentence(),
        assets_diffs: {
          [safeAddress]: [
            {
              asset: {
                type: 'NATIVE',
              },
              in: [],
              out: [],
            },
          ],
        },
        contract_management: {
          [safeAddress]: [
            {
              type: 'PROXY_UPGRADE',
              before: { address: safeAddress },
              after: { address: safeAddress },
            },
          ],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses a minimal response', () => {
    const response = {
      request_id: undefined,
      validation: {
        result_type: faker.helpers.arrayElement(['Benign', 'Warning']),
        features: [],
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('fails when validation features are missing', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: faker.helpers.arrayElement(['Warning', 'Malicious']),
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Invalid input: expected array, received undefined',
        path: ['validation', 'features'],
      },
    ]);
  });

  it('fails when PROXY_UPGRADE schema validation fails due to invalid address in before', () => {
    const invalidAddress = faker.string.alphanumeric(10);
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: faker.helpers.arrayElement(['Warning', 'Malicious']),
        features: [],
      },
      simulation: {
        status: 'Success',
        contract_management: {
          [safeAddress]: [
            {
              type: 'PROXY_UPGRADE',
              before: { address: invalidAddress },
              after: { address: safeAddress },
            },
          ],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'PROXY_UPGRADE type must match ProxyUpgradeManagementSchema',
        path: ['simulation', 'contract_management', safeAddress, 0, 'type'],
      },
    ]);
  });

  it('fails when PROXY_UPGRADE schema validation fails due to invalid address in after', () => {
    const invalidAddress = faker.string.alphanumeric(10);
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: faker.helpers.arrayElement(['Warning', 'Malicious']),
        features: [],
      },
      simulation: {
        status: 'Success',
        contract_management: {
          [safeAddress]: [
            {
              type: 'PROXY_UPGRADE',
              before: { address: safeAddress },
              after: { address: invalidAddress },
            },
          ],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'PROXY_UPGRADE type must match ProxyUpgradeManagementSchema',
        path: ['simulation', 'contract_management', safeAddress, 0, 'type'],
      },
    ]);
  });

  it('parses validation with error field', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Error',
        error: 'Validation failed',
        features: [],
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses simulation with error field', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Benign',
        features: [],
      },
      simulation: {
        status: 'Error',
        error: 'Simulation failed',
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses response without validation object', () => {
    const response = {
      request_id: faker.string.uuid(),
      simulation: {
        status: 'Success',
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses response without simulation object', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Benign',
        features: [],
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses multiple validation features', () => {
    const address1 = getAddress(faker.finance.ethereumAddress());
    const address2 = getAddress(faker.finance.ethereumAddress());
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Malicious',
        reason: faker.lorem.words(3),
        classification: faker.lorem.word(),
        description: faker.lorem.sentence(),
        features: [
          {
            type: 'Malicious',
            description: faker.lorem.sentence(),
            address: address1,
          },
          {
            type: 'Warning',
            description: faker.lorem.sentence(),
            address: address2,
          },
          {
            type: 'Info',
            description: faker.lorem.sentence(),
          },
        ],
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses empty contract management arrays', () => {
    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Benign',
        features: [],
      },
      simulation: {
        status: 'Success',
        contract_management: {
          [safeAddress]: [],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(response);
  });

  it('parses Blockaid response with multiple OWNERSHIP_CHANGE entries', () => {
    const owner1 = getAddress(faker.finance.ethereumAddress());
    const owner2 = getAddress(faker.finance.ethereumAddress());
    const owner3 = getAddress(faker.finance.ethereumAddress());
    const owner4 = getAddress(faker.finance.ethereumAddress());
    const trustedAddress1 = getAddress(faker.finance.ethereumAddress());
    const trustedAddress2 = getAddress(faker.finance.ethereumAddress());

    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Benign',
        classification: '',
        reason: '',
        description: '',
        features: [
          {
            type: 'Benign',
            feature_id: 'TRUSTED_ADDRESS',
            description: 'A trusted address, safe to interact with',
            address: trustedAddress1,
          },
          {
            type: 'Benign',
            feature_id: 'TRUSTED_ADDRESS',
            description: 'A trusted address, safe to interact with',
            address: trustedAddress2,
          },
        ],
      },
      simulation: {
        status: 'Success',
        assets_diffs: {},
        contract_management: {
          [safeAddress]: [
            {
              type: 'OWNERSHIP_CHANGE',
              before: {
                owners: [owner1, owner2, owner3, owner4],
              },
              after: {
                owners: [owner2, owner4],
              },
            },
            {
              type: 'OWNERSHIP_CHANGE',
              before: {
                owners: [owner1, owner2, owner3, owner4],
              },
              after: {
                owners: [owner2, owner4],
              },
            },
          ],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    // OWNERSHIP_CHANGE entries should only have type field after parsing
    expect(result.data?.simulation?.contract_management?.[safeAddress]).toEqual(
      [{ type: 'OWNERSHIP_CHANGE' }, { type: 'OWNERSHIP_CHANGE' }],
    );
  });

  it('parses Blockaid response with mixed OWNERSHIP_CHANGE and CONTRACT_CREATION', () => {
    const contractAddress = getAddress(faker.finance.ethereumAddress());
    const ownerBefore = getAddress(faker.finance.ethereumAddress());
    const ownerAfter = getAddress(faker.finance.ethereumAddress());
    const deployerAddress = getAddress(faker.finance.ethereumAddress());
    const storedAddress1 = getAddress(faker.finance.ethereumAddress());
    const storedAddress2 = getAddress(faker.finance.ethereumAddress());
    const trustedAddress1 = getAddress(faker.finance.ethereumAddress());
    const trustedAddress2 = getAddress(faker.finance.ethereumAddress());
    const untrustedAddress = getAddress(faker.finance.ethereumAddress());

    const response = {
      request_id: faker.string.uuid(),
      validation: {
        result_type: 'Warning',
        classification: 'untrusted_address',
        reason: 'module_change',
        description: 'The transaction enables an untrusted address as a module',
        features: [
          {
            type: 'Benign',
            feature_id: 'TRUSTED_ADDRESS',
            description: 'A trusted address, safe to interact with',
            address: trustedAddress1,
          },
          {
            type: 'Benign',
            feature_id: 'TRUSTED_ADDRESS',
            description: 'A trusted address, safe to interact with',
            address: trustedAddress2,
          },
          {
            type: 'Warning',
            feature_id: 'UNTRUSTED_ADDRESS',
            description: 'This address is untrusted',
            address: untrustedAddress,
          },
        ],
      },
      simulation: {
        status: 'Success',
        assets_diffs: {},
        contract_management: {
          [contractAddress]: [
            {
              type: 'OWNERSHIP_CHANGE',
              before: {
                owners: [ownerBefore],
              },
              after: {
                owners: [ownerAfter],
              },
            },
            {
              type: 'CONTRACT_CREATION',
              deployer_address: deployerAddress,
              stored_addresses: [storedAddress1, storedAddress2],
            },
          ],
        },
      },
    };

    const result = BlockaidScanResponseSchema.safeParse(response);

    expect(result.success).toBe(true);
    // Both entries should only have type field after parsing
    expect(
      result.data?.simulation?.contract_management?.[contractAddress],
    ).toEqual([{ type: 'OWNERSHIP_CHANGE' }, { type: 'CONTRACT_CREATION' }]);
  });
});
