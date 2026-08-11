// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyGroupBuilder } from '@/modules/policies/domain/entities/__tests__/policy-group.builder';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { AllowPolicyResolver } from '@/modules/policies/domain/resolvers/allow-policy.resolver';

describe('AllowPolicyResolver', () => {
  let resolver: AllowPolicyResolver;
  const chainId = faker.string.numeric({ length: 3 });

  beforeEach(() => {
    resolver = new AllowPolicyResolver();
  });

  it('should build one item per group, keyed by its access word', async () => {
    const groups = [
      policyGroupBuilder([policyConfirmationBuilder().build()]),
      policyGroupBuilder([policyConfirmationBuilder().build()]),
    ];

    const result = await resolver.resolve({
      chainId,
      groups,
      names: new Map(),
    });

    expect(result).toStrictEqual(
      groups.map((group) => ({
        id: group.access,
        type: PolicyType.AllowPolicy,
        data: {},
        groups: [group],
      })),
    );
  });

  it('should report one item however often the access was granted', async () => {
    // Re-granting the same access is idempotent on-chain: its events are one
    // group, so the repeated fallback grants of a Safe are one item.
    const grants = [443, 465, 469, 473].map((blockNumber) =>
      policyConfirmationBuilder()
        .with('target', zeroAddress)
        .with('selector', '0x00000000')
        .with('fallback', true)
        .with('blockNumber', blockNumber)
        .build(),
    );
    const group = policyGroupBuilder([
      grants[0],
      grants[1],
      grants[2],
      grants[3],
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(group.access);
    expect(result[0].groups).toStrictEqual([group]);
  });

  it('should report an empty payload for a catch-all fallback', async () => {
    // The fallback AllowPolicy carries no data at all: zeroed access, `0x` and
    // no `dataDecoded`. It must still be reported rather than dropped.
    const group = policyGroupBuilder([
      policyConfirmationBuilder()
        .with('target', zeroAddress)
        .with('selector', '0x00000000')
        .with('fallback', true)
        .with('data', '0x')
        .with('dataDecoded', null)
        .build(),
    ]);

    const result = await resolver.resolve({
      chainId,
      groups: [group],
      names: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].data).toStrictEqual({});
    expect(result[0].type).toBe(PolicyType.AllowPolicy);
    expect(result[0].groups).toStrictEqual([group]);
  });

  it('should return no items when the type has no groups', async () => {
    const result = await resolver.resolve({
      chainId,
      groups: [],
      names: new Map(),
    });

    expect(result).toStrictEqual([]);
  });

  it('should not consult the address book', async () => {
    // An AllowPolicy references no addresses of its own, so a populated address
    // book must not change the payload.
    const group = policyGroupBuilder([policyConfirmationBuilder().build()]);
    const names = new Map([
      [getAddress(faker.finance.ethereumAddress()).toLowerCase(), 'Some name'],
    ]);

    const result = await resolver.resolve({ chainId, groups: [group], names });

    expect(result[0].data).toStrictEqual({});
  });
});
