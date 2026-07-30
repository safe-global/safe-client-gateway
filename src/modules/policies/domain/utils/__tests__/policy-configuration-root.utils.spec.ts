// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, keccak256, size } from 'viem';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';

describe('configurationRoot', () => {
  it('should hash the abi encoding of the configurations', () => {
    // `abi.encode(Configuration[])` of a single dynamic array argument, laid out
    // by hand so the encoding this depends on is asserted, not assumed:
    //
    //   [0x00] offset to the array           = 0x20
    //   [0x20] array length                  = 1
    //   [0x40] offset to element 0, relative = 0x20
    //   [0x60] target       (left-padded)
    //   [0x80] selector     (right-padded)
    //   [0xa0] operation    (left-padded)
    //   [0xc0] policy       (left-padded)
    //   [0xe0] offset to `data`, relative to the element = 0xa0
    //   [0x100] data length = 0
    const configuration = policyConfigurationBuilder()
      .with('target', '0x1111111111111111111111111111111111111111')
      .with('selector', '0xa9059cbb')
      .with('operation', 0)
      .with('policy', '0x2222222222222222222222222222222222222222')
      .with('data', '0x')
      .build();
    const encoded = [
      '0x',
      '0000000000000000000000000000000000000000000000000000000000000020',
      '0000000000000000000000000000000000000000000000000000000000000001',
      '0000000000000000000000000000000000000000000000000000000000000020',
      '0000000000000000000000001111111111111111111111111111111111111111',
      'a9059cbb00000000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000000',
      '0000000000000000000000002222222222222222222222222222222222222222',
      '00000000000000000000000000000000000000000000000000000000000000a0',
      '0000000000000000000000000000000000000000000000000000000000000000',
    ].join('') as `0x${string}`;

    expect(configurationRoot([configuration])).toBe(keccak256(encoded));
  });

  it('should return a 32 byte hash', () => {
    const root = configurationRoot([policyConfigurationBuilder().build()]);

    expect(size(root)).toBe(32);
  });

  it('should be stable across calls', () => {
    const configurations = [
      policyConfigurationBuilder().build(),
      policyConfigurationBuilder().build(),
    ];

    expect(configurationRoot(configurations)).toBe(
      configurationRoot(configurations),
    );
  });

  it('should be order sensitive', () => {
    const first = policyConfigurationBuilder().build();
    const second = policyConfigurationBuilder().build();

    expect(configurationRoot([first, second])).not.toBe(
      configurationRoot([second, first]),
    );
  });

  it.each([
    ['target', getAddress(faker.finance.ethereumAddress())],
    ['selector', '0x23b872dd'],
    ['policy', getAddress(faker.finance.ethereumAddress())],
    ['data', '0xdeadbeef'],
  ] as const)('should change when %s changes', (field, value) => {
    const configuration = policyConfigurationBuilder().build();

    expect(configurationRoot([configuration])).not.toBe(
      configurationRoot([{ ...configuration, [field]: value }]),
    );
  });

  it('should change when the operation changes', () => {
    const configuration = policyConfigurationBuilder()
      .with('operation', 0)
      .build();

    expect(configurationRoot([configuration])).not.toBe(
      configurationRoot([{ ...configuration, operation: 1 }]),
    );
  });

  it('should differ per number of configurations', () => {
    const configuration = policyConfigurationBuilder().build();

    expect(configurationRoot([configuration])).not.toBe(
      configurationRoot([configuration, configuration]),
    );
  });

  it('should be case insensitive on addresses', () => {
    const configuration = policyConfigurationBuilder().build();

    expect(
      configurationRoot([
        {
          ...configuration,
          target: configuration.target.toLowerCase() as `0x${string}`,
          policy: configuration.policy.toLowerCase() as `0x${string}`,
        },
      ]),
    ).toBe(configurationRoot([configuration]));
  });
});
