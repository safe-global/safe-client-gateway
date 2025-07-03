import { rewardsFeeBuilder } from '@/datasources/staking-api/entities/__tests__/rewards-fee.entity.builder';
import { RewardsFeeSchema } from '@/datasources/staking-api/entities/rewards-fee.entity';
import { faker } from '@faker-js/faker';

describe('RewardsFeeSchema', () => {
  it('should validate a RewardsFee object with a number fee', () => {
    const rewardsFee = rewardsFeeBuilder().build();

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(rewardsFee);
    }
  });

  it('should validate a RewardsFee object with null fee', () => {
    const rewardsFee = { fee: null };

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(rewardsFee);
    }
  });

  it('should validate a RewardsFee object with undefined fee and default to null', () => {
    const rewardsFeeWithoutFee = {};

    const result = RewardsFeeSchema.safeParse(rewardsFeeWithoutFee);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fee).toBe(null);
    }
  });

  it.each([
    ['string', faker.string.numeric() as unknown as number],
    ['boolean', faker.datatype.boolean() as unknown as number],
    ['object', {} as unknown as number],
    ['array', [] as unknown as number],
  ])(
    'should not validate a RewardsFee object with %s fee',
    (type, invalidFee) => {
      const rewardsFee = { fee: invalidFee };

      const result = RewardsFeeSchema.safeParse(rewardsFee);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]).toStrictEqual({
          code: 'invalid_type',
          expected: 'number',
          message: `Expected number, received ${type}`,
          path: ['fee'],
          received: type,
        });
      }
    },
  );

  it.each([
    ['zero', 0],
    ['negative', -0.1],
    ['very large', 999999.999],
  ])('should validate a RewardsFee object with %s fee', (description, fee) => {
    const rewardsFee = { fee };

    const result = RewardsFeeSchema.safeParse({ fee });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(rewardsFee);
    }
  });

  it('should validate an empty object and default fee to null', () => {
    const result = RewardsFeeSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fee).toBe(null);
    }
  });

  it('should validate a RewardsFee object with extra properties and strip them', () => {
    const rewardsFee = {
      fee: faker.number.float(),
      extraProperty: 'should not be here',
    };

    const result = RewardsFeeSchema.safeParse(rewardsFee);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual({
        fee: rewardsFee.fee,
      });
    }
  });
});
