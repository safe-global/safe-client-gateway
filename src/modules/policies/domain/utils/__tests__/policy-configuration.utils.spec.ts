// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';
import { toPolicyInfo } from '@/modules/policies/domain/utils/policy-configuration.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

describe('toPolicyInfo', () => {
  it('should report the access and the policy contract of a configuration', () => {
    const configuration = policyConfigurationBuilder().build();

    const result = toPolicyInfo(configuration);

    expect(result).toStrictEqual({
      id: accessSelector({
        target: configuration.target,
        selector: configuration.selector,
        operation: PolicyOperation.Call,
      }),
      target: configuration.target,
      selector: configuration.selector,
      operation: PolicyOperation.Call,
      policyContract: configuration.policy,
    });
  });

  it.each([
    [0, PolicyOperation.Call],
    [1, PolicyOperation.DelegateCall],
  ] as const)('should map operation %i to %s', (value, operation) => {
    const configuration = policyConfigurationBuilder()
      .with('operation', value)
      .build();

    expect(toPolicyInfo(configuration).operation).toBe(operation);
  });

  it('should report a zero policy address as a removal', () => {
    const configuration = policyConfigurationBuilder()
      .with('policy', NULL_ADDRESS)
      .build();

    expect(toPolicyInfo(configuration).policyContract).toBeNull();
  });

  it('should report a set policy as itself', () => {
    const policy = getAddress(faker.finance.ethereumAddress());
    const configuration = policyConfigurationBuilder()
      .with('policy', policy)
      .build();

    expect(toPolicyInfo(configuration).policyContract).toBe(policy);
  });

  it('should differ per operation for the same target and selector', () => {
    const configuration = policyConfigurationBuilder()
      .with('operation', 0)
      .build();

    expect(toPolicyInfo(configuration).id).not.toBe(
      toPolicyInfo({ ...configuration, operation: 1 }).id,
    );
  });

  it('should produce the id the active policies path produces for the same access', () => {
    // What lets the wallet line a pending binding up against the policy it will
    // replace: both sides key on the on-chain access word.
    const configuration = policyConfigurationBuilder().build();
    const confirmation = policyConfirmationBuilder()
      .with('target', configuration.target)
      .with('selector', configuration.selector)
      .with('operation', PolicyOperation.Call)
      .build();

    expect(toPolicyInfo(configuration).id).toBe(accessSelector(confirmation));
  });
});
