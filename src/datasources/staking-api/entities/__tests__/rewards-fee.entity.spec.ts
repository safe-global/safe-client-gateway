import { rewardsFeeBuilder } from '@/datasources/staking-api/entities/__tests__/rewards-fee.entity.builder';
import { RewardsFeeSchema } from '@/datasources/staking-api/entities/rewards-fee.entity';
import { faker } from '@faker-js/faker';

describe('RewardsFeeSchema', () => {
  it.each([
    ['number', faker.number.float()],
    ['null', null],
    ['zero', 0],
    ['negative', -0.1],
    ['very large', 999999.999],
  ])('should validate a RewardsFee object with a %s fee value', (_, fee) => {
    const rewardsFee = rewardsFeeBuilder().with('fee', fee).build();

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result).toStrictEqual({
      success: true,
      data: rewardsFee,
    });
  });

  it.each([
    ['undefined fee', { fee: undefined }],
    ['empty object', {}],
  ])('should validate an %s and default fee to 0', (_, rewardsFee) => {
    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result).toStrictEqual({
      success: true,
      data: { fee: 0 },
    });
  });

  it.each([
    ['string', faker.string.numeric()],
    ['boolean', faker.datatype.boolean()],
    ['object', {}],
    ['array', []],
  ])(
    'should not validate a RewardsFee object with a %s fee value',
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

  it('should validate a RewardsFee object with extra properties and strip them', () => {
    const rewardsFee = {
      fee: faker.number.float(),
      extraProperty: 'should not be here',
    };

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result).toStrictEqual({
      success: true,
      data: { fee: rewardsFee.fee },
    });
  });
});
