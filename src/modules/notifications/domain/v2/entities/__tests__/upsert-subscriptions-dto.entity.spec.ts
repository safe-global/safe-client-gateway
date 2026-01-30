import type { DeviceType } from '@/modules/notifications/domain/v2/entities/device-type.entity';
import { NotificationType } from '@/modules/notifications/domain/v2/entities/notification-type.entity';
import { upsertSubscriptionsDtoBuilder } from '@/modules/notifications/routes/v2/entities/__tests__/upsert-subscriptions.dto.builder';
import { UpsertSubscriptionsDtoSchema } from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import { faker } from '@faker-js/faker';
import type { UUID } from 'crypto';
import { type Address, getAddress } from 'viem';

describe('UpsertSubscriptionsDtoSchema', () => {
  it('should validate a valid UpsertSubscriptionsDto', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success).toBe(true);
  });

  it('should require cloudMessagingToken', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.cloudMessagingToken;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['cloudMessagingToken'],
      },
    ]);
  });

  it('should require safes', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.safes;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Invalid input: expected array, received undefined',
        path: ['safes'],
      },
    ]);
  });

  it('should require deviceType', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.deviceType;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        message: 'Invalid option: expected one of "ANDROID"|"IOS"|"WEB"',
        path: ['deviceType'],
        values: ['ANDROID', 'IOS', 'WEB'],
      },
    ]);
  });

  it('should not allow non-deviceType values for deviceType', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('deviceType', 'not-a-device-type' as DeviceType)
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        message: 'Invalid option: expected one of "ANDROID"|"IOS"|"WEB"',
        path: ['deviceType'],
        values: ['ANDROID', 'IOS', 'WEB'],
      },
    ]);
  });

  it('should not allow non-UUID values for deviceUuid', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('deviceUuid', 'not-a-uuid' as UUID)
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues[0]).toMatchObject({
      code: 'invalid_format',
      format: 'uuid',
      message: 'Invalid UUID',
      origin: 'string',
      path: ['deviceUuid'],
    });
  });

  it('should allow a nullish deviceUuid, defaulting to null', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete upsertSubscriptionsDto.deviceUuid;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success && result.data.deviceUuid).toBe(null);
  });

  it('should require safes[number].chainId', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.safes[0].chainId;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['safes', 0, 'chainId'],
      },
    ]);
  });

  it('should require safes[number].address', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.safes[0].address;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['safes', 0, 'address'],
      },
    ]);
  });

  it('should require safes[number].notificationTypes', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();
    // @ts-expect-error - testing required field
    delete upsertSubscriptionsDto.safes[0].notificationTypes;

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Invalid input: expected array, received undefined',
        path: ['safes', 0, 'notificationTypes'],
      },
    ]);
  });

  it('should checksum safes[number].address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: nonChecksummedAddress as Address,
          notificationTypes: faker.helpers.arrayElements(
            Object.values(NotificationType),
          ),
        },
      ])
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(result.success && result.data.safes[0].address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should only allow NotificationType values for safes[number].notificationTypes', () => {
    const upsertSubscriptionsDto = upsertSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
          notificationTypes: ['not-a-notification-type' as NotificationType],
        },
      ])
      .build();

    const result = UpsertSubscriptionsDtoSchema.safeParse(
      upsertSubscriptionsDto,
    );

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_value',
        message:
          'Invalid option: expected one of "CONFIRMATION_REQUEST"|"DELETED_MULTISIG_TRANSACTION"|"EXECUTED_MULTISIG_TRANSACTION"|"INCOMING_ETHER"|"INCOMING_TOKEN"|"MESSAGE_CONFIRMATION_REQUEST"|"MODULE_TRANSACTION"',
        path: ['safes', 0, 'notificationTypes', 0],
        values: [
          'CONFIRMATION_REQUEST',
          'DELETED_MULTISIG_TRANSACTION',
          'EXECUTED_MULTISIG_TRANSACTION',
          'INCOMING_ETHER',
          'INCOMING_TOKEN',
          'MESSAGE_CONFIRMATION_REQUEST',
          'MODULE_TRANSACTION',
        ],
      },
    ]);
  });
});
