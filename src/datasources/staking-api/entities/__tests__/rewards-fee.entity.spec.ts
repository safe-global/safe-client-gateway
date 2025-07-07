import { rewardsFeeBuilder } from '@/datasources/staking-api/entities/__tests__/rewards-fee.entity.builder';
import { RewardsFeeSchema } from '@/datasources/staking-api/entities/rewards-fee.entity';
import { faker } from '@faker-js/faker';

describe('RewardsFeeSchema', () => {
  it('should validate a RewardsFee object with a number fee', () => {
    const rewardsFee = rewardsFeeBuilder().build();

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(rewardsFee);
  });

  it.each([
    ['undefined fee', { fee: undefined }],
    ['empty object', {}],
  ])('should validate an %s and default to 0', (_, rewardsFee) => {
    const result = RewardsFeeSchema.safeParse(rewardsFee);
    expect(result.success).toBe(true);
    expect(result.data?.fee).toBe(0);
  });

  it.each([
    ['string', faker.string.numeric()],
    ['null', null],
    ['boolean', faker.datatype.boolean()],
    ['object', {}],
    ['array', []],
  ])(
    'should not validate a RewardsFee object with %s fee',
    (type, invalidFee) => {
      const rewardsFee = { fee: invalidFee };

      const result = RewardsFeeSchema.safeParse(rewardsFee);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toStrictEqual({
        code: 'invalid_type',
        expected: 'number',
        message: `Expected number, received ${type}`,
        path: ['fee'],
        received: type,
      });
    },
  );

  it.each([
    ['zero', 0],
    ['negative', -0.1],
    ['very large', 999999.999],
  ])('should validate a RewardsFee object with %s fee', (_, fee) => {
    const rewardsFee = { fee };

    const result = RewardsFeeSchema.safeParse({ fee });

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual(rewardsFee);
  });

  it('should validate a RewardsFee object with extra properties and strip them', () => {
    const rewardsFee = {
      fee: faker.number.float(),
      extraProperty: 'should not be here',
    };

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({
      fee: rewardsFee.fee,
    });
  });
});
