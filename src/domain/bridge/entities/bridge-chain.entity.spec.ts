import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { bridgeChainBuilder } from '@/domain/bridge/entities/__tests__/bridge-chain.builder';
import { BridgeChainSchema } from '@/domain/bridge/entities/bridge-chain.entity';

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
      .with('diamondAddress', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = BridgeChainSchema.safeParse(bridgeChain);

    expect(result.success && result.data.diamondAddress).toBe(
      getAddress(nonChecksummedAddress),
    );
  });
});
