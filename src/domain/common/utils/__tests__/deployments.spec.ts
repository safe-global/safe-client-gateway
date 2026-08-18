// SPDX-License-Identifier: FSL-1.1-MIT

import { getAddress } from 'viem';
import {
  getExtensibleFallbackHandlerVersions,
  getFallbackHandlerVersions,
  getSafeToL2SetupVersions,
  isExtensibleFallbackHandlerDeployed,
  isFallbackHandlerDeployed,
} from '@/domain/common/utils/deployments';

// Canonical 1.5.0 deployment addresses (identical across all chains)
const EXTENSIBLE_FALLBACK_HANDLER_150 = getAddress(
  '0x85a8ca358D388530ad0fB95D0cb89Dd44Fc242c3',
);
const COMPATIBILITY_FALLBACK_HANDLER_150 = getAddress(
  '0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4',
);
const MAINNET_CHAIN_ID = '1';

describe('deployments', () => {
  describe('getFallbackHandlerVersions', () => {
    it('should include all CompatibilityFallbackHandler versions', () => {
      expect(getFallbackHandlerVersions()).toEqual(
        expect.arrayContaining(['1.3.0', '1.4.1', '1.5.0']),
      );
    });
  });

  describe('getExtensibleFallbackHandlerVersions', () => {
    it('should include 1.5.0, the version the ExtensibleFallbackHandler was introduced in', () => {
      expect(getExtensibleFallbackHandlerVersions()).toEqual(
        expect.arrayContaining(['1.5.0']),
      );
    });
  });

  describe('getSafeToL2SetupVersions', () => {
    it('should include all SafeToL2Setup versions', () => {
      expect(getSafeToL2SetupVersions()).toEqual(
        expect.arrayContaining(['1.4.1', '1.5.0']),
      );
    });
  });

  describe('isExtensibleFallbackHandlerDeployed', () => {
    it('should return true for the canonical ExtensibleFallbackHandler deployment', () => {
      expect(
        isExtensibleFallbackHandlerDeployed({
          chainId: MAINNET_CHAIN_ID,
          version: '1.5.0',
          address: EXTENSIBLE_FALLBACK_HANDLER_150,
        }),
      ).toBe(true);
    });

    it('should return false for the CompatibilityFallbackHandler deployment', () => {
      expect(
        isExtensibleFallbackHandlerDeployed({
          chainId: MAINNET_CHAIN_ID,
          version: '1.5.0',
          address: COMPATIBILITY_FALLBACK_HANDLER_150,
        }),
      ).toBe(false);
    });

    it('should return false for versions preceding the ExtensibleFallbackHandler', () => {
      expect(
        isExtensibleFallbackHandlerDeployed({
          chainId: MAINNET_CHAIN_ID,
          version: '1.4.1',
          address: EXTENSIBLE_FALLBACK_HANDLER_150,
        }),
      ).toBe(false);
    });
  });

  describe('isFallbackHandlerDeployed', () => {
    it('should not recognize the ExtensibleFallbackHandler as a CompatibilityFallbackHandler', () => {
      expect(
        isFallbackHandlerDeployed({
          chainId: MAINNET_CHAIN_ID,
          version: '1.5.0',
          address: EXTENSIBLE_FALLBACK_HANDLER_150,
        }),
      ).toBe(false);
    });
  });
});
