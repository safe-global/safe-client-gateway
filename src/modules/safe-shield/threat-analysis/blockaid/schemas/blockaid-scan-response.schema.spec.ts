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
        received: 'undefined',
        path: ['validation', 'features'],
        message: 'Required',
      },
    ]);
  });

  it('fails when simulation contract management contains an invalid address in before', () => {
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
        message: 'Invalid address',
        path: [
          'simulation',
          'contract_management',
          safeAddress,
          0,
          'before',
          'address',
        ],
      },
    ]);
  });

  it('fails when simulation contract management contains an invalid address in after', () => {
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
        message: 'Invalid address',
        path: [
          'simulation',
          'contract_management',
          safeAddress,
          0,
          'after',
          'address',
        ],
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
});
