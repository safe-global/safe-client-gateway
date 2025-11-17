import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { bridgeChainBuilder } from '@/modules/bridge/domain/entities/__tests__/bridge-chain.builder';
import { BridgeChainSchema } from '@/modules/bridge/domain/entities/bridge-chain.entity';

describe('BridgeChainSchema', () => {
  it('should validate a BridgeChain', () => {
    const bridgeChain = bridgeChainBuilder().build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success).toBe(true);
  });

  it('should coerce id to string', () => {
    const id = faker.number.int();
    const bridgeChain = bridgeChainBuilder()
      .with('id', id as unknown as string)
      .build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success && result.data.id).toBe(id.toString());
  });

  it('should checksum diamondAddress', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const bridgeChain = bridgeChainBuilder()
      .with('diamondAddress', nonChecksummedAddress as Address)
      .build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success && result.data.diamondAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should allow diamondAddress to be undefined', () => {
    const bridgeChain = bridgeChainBuilder()
      .with('diamondAddress', undefined)
      .build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success).toBe(true);
    expect(result.success && result.data.diamondAddress).toBeUndefined();
  });

  it('should allow diamondAddress to be omitted', () => {
    const bridgeChain = {
      id: faker.string.numeric(),
    };

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success).toBe(true);
    expect(result.success && result.data.diamondAddress).toBeUndefined();
  });

  it('should reject invalid diamondAddress format', () => {
    const invalidAddress = 'invalid-address';
    const bridgeChain = bridgeChainBuilder()
      .with('diamondAddress', invalidAddress as Address)
      .build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid address');
    }
  });
});
