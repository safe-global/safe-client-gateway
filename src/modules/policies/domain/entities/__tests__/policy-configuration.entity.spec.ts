// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import {
  MAX_POLICY_CONFIGURATION_DATA_BYTES,
  MAX_POLICY_CONFIGURATIONS_PER_REQUEST,
  PolicyConfigurationSchema,
  PolicyConfigurationsSchema,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

/** `data` of exactly {@link bytes} bytes. */
function dataOfBytes(bytes: number): `0x${string}` {
  return `0x${'ab'.repeat(bytes)}`;
}

describe('PolicyConfigurationSchema', () => {
  it('should validate a configuration', () => {
    const configuration = policyConfigurationBuilder().build();

    const result = PolicyConfigurationSchema.safeParse(configuration);

    expect(result.success).toBe(true);
  });

  it('should checksum addresses', () => {
    const target = faker.finance.ethereumAddress().toLowerCase();
    const policy = faker.finance.ethereumAddress().toLowerCase();
    const configuration = policyConfigurationBuilder()
      .with('target', target as `0x${string}`)
      .with('policy', policy as `0x${string}`)
      .build();

    const result = PolicyConfigurationSchema.parse(configuration);

    expect(result.target).toBe(getAddress(target));
    expect(result.policy).toBe(getAddress(policy));
  });

  it.each([[Operation.CALL], [Operation.DELEGATE]])(
    'should accept operation %i',
    (operation) => {
      const configuration = policyConfigurationBuilder()
        .with('operation', operation)
        .build();

      expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
        true,
      );
    },
  );

  it.each([[2], [-1], ['CALL']])(
    'should not validate operation %s',
    (operation) => {
      const configuration = policyConfigurationBuilder()
        .with('operation', operation as never)
        .build();

      expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
        false,
      );
    },
  );

  it.each([
    ['too short', '0xa9059c'],
    ['too long', '0xa9059cbbaa'],
    ['of odd length', '0xa9059cb'],
    ['not hex', 'a9059cbb'],
  ])('should not validate a selector that is %s', (_, selector) => {
    const configuration = policyConfigurationBuilder()
      .with('selector', selector as `0x${string}`)
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      false,
    );
  });

  it('should accept empty data, as a policy without a payload emits it', () => {
    const configuration = policyConfigurationBuilder()
      .with('data', '0x')
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      true,
    );
  });

  it('should not validate non-hex data', () => {
    const configuration = policyConfigurationBuilder()
      .with('data', 'deadbeef' as `0x${string}`)
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      false,
    );
  });

  it('should not validate data of odd length', () => {
    // ABI encoding pads it, so it would hash to bytes it does not spell.
    const configuration = policyConfigurationBuilder()
      .with('data', '0xabc')
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      false,
    );
  });

  it('should validate data of up to the maximum size', () => {
    const configuration = policyConfigurationBuilder()
      .with('data', dataOfBytes(MAX_POLICY_CONFIGURATION_DATA_BYTES))
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      true,
    );
  });

  it('should not validate data above the maximum size', () => {
    const configuration = policyConfigurationBuilder()
      .with('data', dataOfBytes(MAX_POLICY_CONFIGURATION_DATA_BYTES + 1))
      .build();

    expect(PolicyConfigurationSchema.safeParse(configuration).success).toBe(
      false,
    );
  });

  describe('PolicyConfigurationsSchema', () => {
    it('should validate a non-empty list', () => {
      const configurations = [
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
      ];

      expect(PolicyConfigurationsSchema.safeParse(configurations).success).toBe(
        true,
      );
    });

    it('should not validate an empty list', () => {
      // A request configuring nothing hashes to a root no wallet flow produces.
      expect(PolicyConfigurationsSchema.safeParse([]).success).toBe(false);
    });

    it('should validate up to the maximum number of configurations', () => {
      const configurations = Array.from(
        { length: MAX_POLICY_CONFIGURATIONS_PER_REQUEST },
        () => policyConfigurationBuilder().build(),
      );

      expect(PolicyConfigurationsSchema.safeParse(configurations).success).toBe(
        true,
      );
    });

    it('should not validate more than the maximum number of configurations', () => {
      const configurations = Array.from(
        { length: MAX_POLICY_CONFIGURATIONS_PER_REQUEST + 1 },
        () => policyConfigurationBuilder().build(),
      );

      expect(PolicyConfigurationsSchema.safeParse(configurations).success).toBe(
        false,
      );
    });
  });
});
