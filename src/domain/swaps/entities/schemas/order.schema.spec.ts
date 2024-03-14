import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { OrderSchema } from '@/domain/swaps/entities/schemas/order.schema';
import { faker } from '@faker-js/faker';

describe('OrderSchema', () => {
  it('should validate a valid order', () => {
    const order = orderBuilder().build();

    const result = OrderSchema.safeParse(order);

    expect(result.success).toBe(true);
  });

  it('should fallback to unknown sellTokenBalance on order with an invalid sellTokenBalance', () => {
    const order = {
      ...orderBuilder().build(),
      sellTokenBalance: faker.string.sample(),
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.sellTokenBalance).toBe('unknown');
  });

  it('should fallback to unknown buyTokenBalance on order with an invalid buyTokenBalance', () => {
    const order = {
      ...orderBuilder().build(),
      buyTokenBalance: faker.string.sample(),
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.buyTokenBalance).toBe('unknown');
  });

  it('should fallback to unknown signingScheme on order with an invalid signingScheme', () => {
    const order = {
      ...orderBuilder().build(),
      signingScheme: faker.string.sample(),
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.signingScheme).toBe('unknown');
  });

  it('should fallback to unknown class on order with an invalid class', () => {
    const order = { ...orderBuilder().build(), class: faker.string.sample() };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.class).toBe('unknown');
  });

  it('should fallback to unknown status on order with an invalid status', () => {
    const order = { ...orderBuilder().build(), status: faker.string.sample() };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.status).toBe('unknown');
  });

  it('should fallback to unknown placementError on order with an invalid placementError', () => {
    const order = {
      ...orderBuilder().build(),
      onchainOrderData: {
        sender: faker.finance.ethereumAddress(),
        placementError: faker.string.sample(),
      },
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.onchainOrderData?.placementError).toBe(
      'unknown',
    );
  });
});
