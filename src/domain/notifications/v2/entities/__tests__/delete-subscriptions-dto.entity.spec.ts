import { deleteSubscriptionsDtoBuilder } from '@/routes/notifications/v2/entities/__tests__/delete-subscriptions.dto.builder';
import { DeleteSubscriptionsDtoSchema } from '@/domain/notifications/v2/entities/delete-subscriptions.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('DeleteSubscriptionsDtoSchema', () => {
  it('should validate a valid DeleteSubscriptionsDto', () => {
    const dto = deleteSubscriptionsDtoBuilder().build();

    const result = DeleteSubscriptionsDtoSchema.safeParse(dto);

    expect(result.success).toBe(true);
  });

  it('should require safes', () => {
    const dto = deleteSubscriptionsDtoBuilder().build();
    // @ts-expect-error test missing property
    delete dto.safes;

    const result = DeleteSubscriptionsDtoSchema.safeParse(dto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'array',
        message: 'Required',
        path: ['safes'],
        received: 'undefined',
      },
    ]);
  });

  it.each([
    ['chainId' as const, 'string'],
    ['address' as const, 'string'],
  ])('should require safes[number].%s', (key, expected) => {
    const dto = deleteSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ])
      .build();

    delete dto.safes[0][key];

    const result = DeleteSubscriptionsDtoSchema.safeParse(dto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected,
        message: 'Required',
        path: ['safes', 0, key],
        received: 'undefined',
      },
    ]);
  });

  it('should checksum safes[number].address', () => {
    const nonChecksum = faker.finance.ethereumAddress().toLowerCase();
    const dto = deleteSubscriptionsDtoBuilder()
      .with('safes', [
        {
          chainId: faker.string.numeric(),
          address: nonChecksum as `0x${string}`,
        },
      ])
      .build();

    const result = DeleteSubscriptionsDtoSchema.safeParse(dto);

    expect(result.success && result.data.safes[0].address).toBe(
      getAddress(nonChecksum),
    );
  });
});
