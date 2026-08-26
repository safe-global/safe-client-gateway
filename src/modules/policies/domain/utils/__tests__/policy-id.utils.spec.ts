// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-operation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import {
  guardPolicyId,
  modulePolicyId,
  offChainPolicyId,
} from '@/modules/policies/domain/utils/policy-id.utils';

const SEPOLIA = '11155111';
const TRANSFER_SELECTOR = '0xa9059cbb';

describe('policy id derivation', () => {
  describe('guardPolicyId', () => {
    it('should build the access word the guard keys the policy by', () => {
      // A real binding, as the indexer reports it: the word is the on-chain key,
      // so this literal is the contract under test rather than a fixture.
      const id = guardPolicyId({
        target: getAddress('0x51ff5573d2364108Dd4F294f28173F90E124b9F5'),
        selector: TRANSFER_SELECTOR,
        operation: PolicyOperation.Call,
      });

      expect(id).toBe(
        '0xa9059cbb000000000000000051ff5573d2364108dd4f294f28173f90e124b9f5',
      );
    });

    it('should build the all-zero word for the fallback access', () => {
      const id = guardPolicyId({
        target: zeroAddress,
        selector: '0x00000000',
        operation: PolicyOperation.Call,
      });

      expect(id).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('should place the operation in the fifth byte', () => {
      const target = getAddress(faker.finance.ethereumAddress());

      const call = guardPolicyId({
        target,
        selector: TRANSFER_SELECTOR,
        operation: PolicyOperation.Call,
      });
      const delegateCall = guardPolicyId({
        target,
        selector: TRANSFER_SELECTOR,
        operation: PolicyOperation.DelegateCall,
      });

      expect(call.slice(10, 12)).toBe('00');
      expect(delegateCall.slice(10, 12)).toBe('01');
      expect(call).not.toBe(delegateCall);
    });

    it('should be independent of the casing of the target', () => {
      const target = getAddress(faker.finance.ethereumAddress());

      expect(
        guardPolicyId({
          target,
          selector: TRANSFER_SELECTOR,
          operation: PolicyOperation.Call,
        }),
      ).toBe(
        guardPolicyId({
          target: target.toLowerCase() as `0x${string}`,
          selector: TRANSFER_SELECTOR,
          operation: PolicyOperation.Call,
        }),
      );
    });
  });

  describe('modulePolicyId', () => {
    const moduleAddress = getAddress(faker.finance.ethereumAddress());
    const safe = {
      chainId: SEPOLIA,
      address: getAddress(faker.finance.ethereumAddress()),
    };

    it('should be stable across calls', () => {
      const args = { type: PolicyType.SpendingLimit, moduleAddress, safe };

      expect(modulePolicyId(args)).toBe(modulePolicyId(args));
    });

    it('should differ per safe', () => {
      // One allowance-module policy exists per Safe, so a derivation over the
      // type and module alone would collide for every Safe in a Space.
      const other = {
        chainId: SEPOLIA,
        address: getAddress(faker.finance.ethereumAddress()),
      };

      expect(
        modulePolicyId({ type: PolicyType.SpendingLimit, moduleAddress, safe }),
      ).not.toBe(
        modulePolicyId({
          type: PolicyType.SpendingLimit,
          moduleAddress,
          safe: other,
        }),
      );
    });

    it('should differ per chain for the same safe address', () => {
      // A Space can hold the same address on two chains, with different state.
      expect(
        modulePolicyId({ type: PolicyType.SpendingLimit, moduleAddress, safe }),
      ).not.toBe(
        modulePolicyId({
          type: PolicyType.SpendingLimit,
          moduleAddress,
          safe: { chainId: '137', address: safe.address },
        }),
      );
    });

    it('should differ per module deployment', () => {
      // Two allowance-module versions on one chain hold independent state, so
      // they are two policies rather than one.
      expect(
        modulePolicyId({ type: PolicyType.SpendingLimit, moduleAddress, safe }),
      ).not.toBe(
        modulePolicyId({
          type: PolicyType.SpendingLimit,
          moduleAddress: getAddress(faker.finance.ethereumAddress()),
          safe,
        }),
      );
    });

    it('should differ per policy type', () => {
      expect(
        modulePolicyId({ type: PolicyType.SpendingLimit, moduleAddress, safe }),
      ).not.toBe(
        modulePolicyId({ type: PolicyType.Recovery, moduleAddress, safe }),
      );
    });
  });

  describe('offChainPolicyId', () => {
    const grantee = getAddress(faker.finance.ethereumAddress());
    const safe = {
      chainId: SEPOLIA,
      address: getAddress(faker.finance.ethereumAddress()),
    };

    it('should be stable across calls', () => {
      const args = { type: PolicyType.Proposer, grantee, safe };

      expect(offChainPolicyId(args)).toBe(offChainPolicyId(args));
    });

    it('should differ per grantee', () => {
      expect(
        offChainPolicyId({ type: PolicyType.Proposer, grantee, safe }),
      ).not.toBe(
        offChainPolicyId({
          type: PolicyType.Proposer,
          grantee: getAddress(faker.finance.ethereumAddress()),
          safe,
        }),
      );
    });

    it('should differ per safe, so one proposer on two safes is two grants', () => {
      expect(
        offChainPolicyId({ type: PolicyType.Proposer, grantee, safe }),
      ).not.toBe(
        offChainPolicyId({
          type: PolicyType.Proposer,
          grantee,
          safe: {
            chainId: SEPOLIA,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        }),
      );
    });

    it('should not collide with a module policy of the same shape', () => {
      expect(
        offChainPolicyId({ type: PolicyType.Proposer, grantee, safe }),
      ).not.toBe(
        modulePolicyId({
          type: PolicyType.Proposer,
          moduleAddress: grantee,
          safe,
        }),
      );
    });
  });
});
