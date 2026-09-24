// SPDX-License-Identifier: FSL-1.1-MIT

import { getAddress } from 'viem';
import {
  getAllowanceModuleAbi,
  getAllowanceModuleDeployments,
  getExtensibleFallbackHandlerVersions,
  getFallbackHandlerVersions,
  getSafeL2SingletonVersions,
  getSafeMigrationVersions,
  getSafeSingletonVersions,
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

  describe('getSafeSingletonVersions', () => {
    it('should include all L1 singleton versions', () => {
      expect(getSafeSingletonVersions()).toEqual(
        expect.arrayContaining(['1.3.0', '1.4.1', '1.5.0']),
      );
    });
  });

  describe('getSafeL2SingletonVersions', () => {
    it('should include all L2 singleton versions', () => {
      expect(getSafeL2SingletonVersions()).toEqual(
        expect.arrayContaining(['1.3.0', '1.4.1', '1.5.0']),
      );
    });
  });

  describe('getSafeMigrationVersions', () => {
    it('should include all SafeMigration versions', () => {
      expect(getSafeMigrationVersions()).toEqual(
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

  describe('getAllowanceModuleDeployments', () => {
    it('should return the addresses of every published version deployed on the chain', () => {
      // Gnosis Chain runs both v0.1.0 and v0.1.1 of the Allowance Module, at
      // different addresses - the union this function exists to return.
      const GNOSIS_CHAIN_ID = '100';

      expect(
        getAllowanceModuleDeployments({ chainId: GNOSIS_CHAIN_ID }),
      ).toEqual(
        expect.arrayContaining([
          getAddress('0xAA46724893dedD72658219405185Fb0Fc91e091C'), // v0.1.1
          getAddress('0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134'), // v0.1.0
        ]),
      );
    });

    it('should return only the versions actually deployed on the chain', () => {
      // Sepolia only ever received v0.1.0 - v0.1.1 was never deployed there.
      const SEPOLIA_CHAIN_ID = '11155111';

      expect(
        getAllowanceModuleDeployments({ chainId: SEPOLIA_CHAIN_ID }),
      ).toEqual([getAddress('0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134')]);
    });

    it('should return an empty array for a chain with no Allowance Module deployment', () => {
      expect(getAllowanceModuleDeployments({ chainId: '999999999' })).toEqual(
        [],
      );
    });
  });

  describe('getAllowanceModuleAbi', () => {
    it('should include the functions the pending-policies decoder depends on', () => {
      const abi = getAllowanceModuleAbi();
      const functionNames = abi
        .filter((item) => item.type === 'function')
        .map((item) => item.name);

      expect(functionNames).toEqual(
        expect.arrayContaining([
          'addDelegate',
          'removeDelegate',
          'setAllowance',
          'resetAllowance',
          'deleteAllowance',
        ]),
      );
    });
  });
});
