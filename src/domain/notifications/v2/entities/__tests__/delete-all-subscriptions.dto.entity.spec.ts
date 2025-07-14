import { DeleteAllSubscriptionsDtoSchema } from '@/domain/notifications/v2/entities/delete-all-subscriptions.dto.entity';
import { deleteAllSubscriptionsDtoBuilder } from '@/domain/notifications/v2/entities/__tests__/delete-all-subscriptions.dto.builder';
import { faker } from '@faker-js/faker';
import type { UUID } from 'crypto';
import { getAddress } from 'viem';

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
        message: 'Required',
        path: ['subscriptions', 0, key],
        received: 'undefined',
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

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message: 'Invalid UUID',
        path: ['subscriptions', 0, 'deviceUuid'],
        validation: 'uuid',
      },
    ]);
  });

  it('should checksum safeAddress', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const deleteAllSubscriptionsDto = {
      subscriptions: [
        {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: nonChecksummedAddress as `0x${string}`,
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
          safeAddress: 'not-an-address' as `0x${string}`,
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
        message: 'Expected string, received number',
        path: ['subscriptions', 0, 'chainId'],
        received: 'number',
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
});
