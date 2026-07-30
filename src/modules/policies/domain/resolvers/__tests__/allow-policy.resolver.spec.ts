// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { AllowPolicyResolver } from '@/modules/policies/domain/resolvers/allow-policy.resolver';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';

describe('AllowPolicyResolver', () => {
  let resolver: AllowPolicyResolver;
  const chainId = faker.string.numeric({ length: 3 });

  beforeEach(() => {
    resolver = new AllowPolicyResolver();
  });

  it('should build one item per confirmation, keyed by its access word', async () => {
    const confirmations = [
      policyConfirmationBuilder().build(),
      policyConfirmationBuilder().build(),
    ];

    const result = await resolver.resolve({
      chainId,
      confirmations,
      names: new Map(),
    });

    expect(result).toStrictEqual(
      confirmations.map((confirmation) => ({
        id: accessSelector(confirmation),
        type: PolicyType.AllowPolicy,
        data: {},
        sources: [confirmation],
      })),
    );
  });

  it('should report an empty payload for a catch-all fallback', async () => {
    // The fallback AllowPolicy carries no data at all: zeroed access, `0x` and
    // no `dataDecoded`. It must still be reported rather than dropped.
    const confirmation = policyConfirmationBuilder()
      .with('target', zeroAddress)
      .with('selector', '0x00000000')
      .with('fallback', true)
      .with('data', '0x')
      .with('dataDecoded', null)
      .build();

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toStrictEqual({});
    expect(result[0].type).toBe(PolicyType.AllowPolicy);
    expect(result[0].sources).toStrictEqual([confirmation]);
  });

  it('should return no items when the type has no confirmations', async () => {
    const result = await resolver.resolve({
      chainId,
      confirmations: [],
      names: new Map(),
    });

    expect(result).toStrictEqual([]);
  });

  it('should not consult the address book', async () => {
    // An AllowPolicy references no addresses of its own, so a populated address
    // book must not change the payload.
    const confirmation = policyConfirmationBuilder().build();
    const names = new Map([
      [getAddress(faker.finance.ethereumAddress()).toLowerCase(), 'Some name'],
    ]);

    const result = await resolver.resolve({
      chainId,
      confirmations: [confirmation],
      names,
    });

    expect(result[0].data).toStrictEqual({});
  });
});
