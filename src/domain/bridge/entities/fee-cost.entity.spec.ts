import { feeCostBuilder } from '@/domain/bridge/entities/__tests__/fee-cost.builder';
import { FeeCostSchema } from '@/domain/bridge/entities/fee-cost.entity';

describe('FeeCostSchema', () => {
  it('should validate a FeeCost', () => {
    const feeCost = feeCostBuilder().build();

    const result = FeeCostSchema.safeParse(feeCost);

    expect(result.success).toBe(true);
  });
});
