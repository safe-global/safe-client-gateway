// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, size } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import {
  accessSelector,
  operationValue,
} from '@/modules/policies/domain/utils/policy-access.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

describe('accessSelector', () => {
  it('should pack selector, operation and target into a 32 byte word', () => {
    const access = accessSelector({
      target: '0x1111111111111111111111111111111111111111',
      selector: '0xa9059cbb',
      operation: PolicyOperation.Call,
    });

    expect(access).toBe(
      '0xa9059cbb00000000000000001111111111111111111111111111111111111111',
    );
    expect(size(access)).toBe(32);
  });

  it('should encode DELEGATECALL in the operation byte', () => {
    const access = accessSelector({
      target: '0x1111111111111111111111111111111111111111',
      selector: '0xa9059cbb',
      operation: PolicyOperation.DelegateCall,
    });

    expect(access).toBe(
      '0xa9059cbb01000000000000001111111111111111111111111111111111111111',
    );
  });

  it('should build the fallback access word from a zero target and selector', () => {
    const access = accessSelector({
      target: NULL_ADDRESS,
      selector: '0x00000000',
      operation: PolicyOperation.Call,
    });

    expect(access).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('should be case insensitive on the target', () => {
    const target = getAddress(faker.finance.ethereumAddress());
    const confirmation = policyConfirmationBuilder()
      .with('target', target)
      .build();

    expect(accessSelector(confirmation)).toBe(
      accessSelector({
        ...confirmation,
        target: target.toLowerCase() as `0x${string}`,
      }),
    );
  });

  it('should differ per operation for the same target and selector', () => {
    const confirmation = policyConfirmationBuilder()
      .with('operation', PolicyOperation.Call)
      .build();

    expect(accessSelector(confirmation)).not.toBe(
      accessSelector({
        ...confirmation,
        operation: PolicyOperation.DelegateCall,
      }),
    );
  });

  it('should be stable across calls', () => {
    const confirmation = policyConfirmationBuilder().build();

    expect(accessSelector(confirmation)).toBe(accessSelector(confirmation));
  });
});

describe('operationValue', () => {
  it.each([
    [PolicyOperation.Call, 0],
    [PolicyOperation.DelegateCall, 1],
  ])('should map %s to %i', (operation, expected) => {
    expect(operationValue(operation)).toBe(expected);
  });
});
