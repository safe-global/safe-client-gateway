// SPDX-License-Identifier: FSL-1.1-MIT
import {
  PolicyType,
  policyTypeFromContractName,
} from '@/modules/policies/domain/entities/policy-type.entity';

describe('policyTypeFromContractName', () => {
  it.each([
    ['ERC20TransferPolicy', PolicyType.Erc20Transfer],
    ['CoSignerPolicy', PolicyType.Cosigner],
    ['AllowPolicy', PolicyType.AllowPolicy],
  ])('should map %s to %s', (name, expected) => {
    expect(policyTypeFromContractName(name)).toBe(expected);
  });

  it.each([
    // Registered in the Transaction Service, and - for DenyPolicy and
    // NativeTransferPolicy - offered by the catalogue, but with no resolver to
    // render a configured one in `/policies/active`.
    'AllowedModulePolicy',
    'DenyPolicy',
    'ERC20ApprovePolicy',
    'MultiSendPolicy',
    'NativeTransferPolicy',
  ])('should not map %s, which CGW cannot resolve', (name) => {
    expect(policyTypeFromContractName(name)).toBeNull();
  });

  it.each([null, undefined, ''])('should return null for %s', (name) => {
    expect(policyTypeFromContractName(name)).toBeNull();
  });

  it('should not map a name that only differs in case', () => {
    // The registry names are contract names; a near-miss is a drift signal, not
    // something to paper over.
    expect(policyTypeFromContractName('cosignerpolicy')).toBeNull();
  });

  it('should not map an unknown future policy', () => {
    expect(policyTypeFromContractName('SomeFuturePolicy')).toBeNull();
  });
});
