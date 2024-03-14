import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { OrderSchema } from '@/domain/swaps/entities/schemas/order.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Order } from '@/domain/swaps/entities/order.entity';

describe('OrderSchema', () => {
  it('should validate a valid order', () => {
    const order = orderBuilder().build();

    const result = OrderSchema.safeParse(order);

    expect(result.success).toBe(true);
  });

  it('hexadecimal signature should be valid', () => {
    const order = {
      ...orderBuilder().build(),
      signature: faker.string.hexadecimal() as `0x${string}`,
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success).toBe(true);
  });

  it.each([null, undefined, faker.string.sample(), faker.string.numeric()])(
    `should fail validation if signature is not hexadecimal`,
    (signature) => {
      const order = {
        ...orderBuilder().build(),
        signature,
      };

      const result = OrderSchema.safeParse(order);

      expect(result.success).toBe(false);
    },
  );

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

  it('should fallback to unknown kind on order with an invalid kind', () => {
    const order = { ...orderBuilder().build(), kind: faker.string.sample() };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data.kind).toBe('unknown');
  });

  it.each<keyof Order>([
    'sellToken',
    'buyToken',
    'receiver',
    'from',
    'owner',
    'onchainUser',
  ])('%s should be checksummed', (key) => {
    const order = {
      ...orderBuilder().build(),
      [key]: faker.finance.ethereumAddress().toLowerCase(),
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data[key]).toBe(
      getAddress(order[key] as string),
    );
  });

  it.each<keyof Order>([
    'receiver',
    'from',
    'quoteId',
    'availableBalance',
    'ethflowData',
    'onchainUser',
    'onchainOrderData',
    'executedSurplusFee',
    'fullAppData',
  ])('%s should default to null if value not present', (key) => {
    const order = orderBuilder().build();
    delete order[key];

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data[key]).toBe(null);
  });

  describe('ethflowData', () => {
    it('should fallback to null if refundTxHash is not present', () => {
      const order = {
        ...orderBuilder().build(),
        ethflowData: { userValidTo: faker.date.future().getTime() },
      };

      const result = OrderSchema.safeParse(order);

      expect(result.success && result.data.ethflowData?.refundTxHash).toBe(
        null,
      );
    });
  });
});
