import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Order, OrderSchema } from '@/domain/swaps/entities/order.entity';

describe('OrderSchema', () => {
  it('should validate a valid order', () => {
    const order = orderBuilder().build();

    const result = OrderSchema.safeParse(order);

    expect(result.success).toBe(true);
  });

  it('hexadecimal signature should be valid', () => {
    const order = orderBuilder()
      .with('signature', faker.string.hexadecimal() as `0x${string}`)
      .build();

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

  it.each<keyof Order>([
    'kind',
    'sellTokenBalance',
    'buyTokenBalance',
    'signingScheme',
    'class',
    'status',
  ])(`should fallback to unknown %s on order with an invalid %s`, (key) => {
    const order = {
      ...orderBuilder().build(),
      [key]: faker.string.sample(),
    };

    const result = OrderSchema.safeParse(order);

    expect(result.success && result.data[key]).toBe('unknown');
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
