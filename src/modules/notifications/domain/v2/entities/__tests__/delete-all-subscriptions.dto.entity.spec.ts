import { DeleteAllSubscriptionsDtoSchema } from '@/modules/notifications/domain/v2/entities/delete-all-subscriptions.dto.entity';
import { deleteAllSubscriptionsDtoBuilder } from '@/modules/notifications/domain/v2/entities/__tests__/delete-all-subscriptions.dto.builder';
import { faker } from '@faker-js/faker';
import type { UUID } from 'crypto';
import { type Address, getAddress } from 'viem';

describe('DeleteAllSubscriptionsDtoSchema', () => {
  it('should validate a valid DeleteAllSubscriptionsDto', () => {
    const deleteAllSubscriptionsDto =
      deleteAllSubscriptionsDtoBuilder().build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
  });

  it('should not allow an empty array', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ['chainId' as const, 'string'],
    ['deviceUuid' as const, 'string'],
    ['safeAddress' as const, 'string'],
  ])('should require %s for each subscription', (key, expected) => {
    const subscriptions = [
      {
        chainId: faker.string.numeric(),
        deviceUuid: faker.string.uuid() as UUID,
        safeAddress: getAddress(faker.finance.ethereumAddress()),
      },
    ];
    delete subscriptions[0][key];

    const deleteAllSubscriptionsDto = {
      subscriptions,
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected,
        message: 'Invalid input: expected string, received undefined',
        path: ['subscriptions', 0, key],
      },
    ]);
  });

  it('should not allow non-UUID values for deviceUuid', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.numeric(),
          deviceUuid: 'not-a-uuid' as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_format',
        format: 'uuid',
        message: 'Invalid UUID',
        path: ['subscriptions', 0, 'deviceUuid'],
        origin: 'string',
      }),
    ]);
  });

  it('should checksum safeAddress', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: nonChecksummedAddress as Address,
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success && result.data.subscriptions[0].safeAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow non-hex address values for safeAddress', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: 'not-an-address' as Address,
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['subscriptions', 0, 'safeAddress'],
      },
    ]);
  });

  it('should validate multiple subscriptions', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
  });

  it('should fail validation when chainId is not a string', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: 123 as unknown as string,
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received number',
        path: ['subscriptions', 0, 'chainId'],
      },
    ]);
  });

  it('should fail validation when chainId is not a valid numeric string', () => {
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.alpha(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ],
    };

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['subscriptions', 0, 'chainId'],
      },
    ]);
  });

  it('should validate signerAddress when provided', () => {
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
  });

  it('should validate when signerAddress is omitted (undefined)', () => {
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          // signerAddress intentionally omitted
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
    expect(
      result.success && result.data.subscriptions[0].signerAddress,
    ).toBeUndefined();
  });

  it('should checksum signerAddress when provided', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: nonChecksummedAddress as Address,
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success && result.data.subscriptions[0].signerAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow non-hex address values for signerAddress', () => {
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: 'not-an-address' as Address,
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['subscriptions', 0, 'signerAddress'],
      },
    ]);
  });

  it('should validate when signerAddress is explicitly set to null', () => {
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: null,
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.subscriptions[0].signerAddress).toBe(
      null,
    );
  });

  it('should validate mixed signerAddress values in array', () => {
    const deleteAllSubscriptionsDto = deleteAllSubscriptionsDtoBuilder()
      .with('subscriptions', [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          // signerAddress omitted (undefined)
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: null,
        },
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          signerAddress: getAddress(faker.finance.ethereumAddress()),
        },
      ])
      .build();

    const result = DeleteAllSubscriptionsDtoSchema.safeParse(
      deleteAllSubscriptionsDto,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptions[0].signerAddress).toBeUndefined();
      expect(result.data.subscriptions[1].signerAddress).toBe(null);
      expect(result.data.subscriptions[2].signerAddress).toBeDefined();
    }
  });
});
