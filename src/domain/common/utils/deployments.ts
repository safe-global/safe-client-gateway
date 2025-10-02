// eslint-disable-next-line no-restricted-imports
import {
  getMultiSendCallOnlyDeployments as _getMultiSendCallOnlyDeployments,
  getMultiSendDeployments as _getMultiSendDeployments,
  getProxyFactoryDeployments as _getProxyFactoryDeployments,
  getSafeL2SingletonDeployments as _getSafeL2SingletonDeployments,
  getSafeSingletonDeployments as _getSafeSingletonDeployments,
  getSafeToL2MigrationDeployments as _getSafeToL2MigrationDeployments,
} from '@safe-global/safe-deployments';
import type { Address } from 'viem';

type Filter = {
  chainId: string;
  version: string;
};

/**
 * Returns a list of official ProxyFactory addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed ProxyFactory addresses
 */
export function getProxyFactoryDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getProxyFactoryDeployments, args);
}

/**
 * Returns a list of official L1 singleton addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed L1 singleton addresses
 */
export function getSafeSingletonDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getSafeSingletonDeployments, args);
}

/**
 * Returns a list of official L2 singleton addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed L2 singleton addresses
 */
export function getSafeL2SingletonDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getSafeL2SingletonDeployments, args);
}

/**
 * Returns a list of official MultiSendCallOnly addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed MultiSendCallOnly addresses
 */
export function getMultiSendCallOnlyDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getMultiSendCallOnlyDeployments, args);
}

/**
 * Returns a list of official MultiSend addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed MultiSend addresses
 */
export function getMultiSendDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getMultiSendDeployments, args);
}

/**
 * Returns a list of official SafeToL2Migration addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed SafeToL2Migration addresses
 */
export function getSafeToL2MigrationDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getSafeToL2MigrationDeployments, args);
}

/**
 * Helper to remap {@link SingletonDeploymentV2} to a list of checksummed addresses.
 *
 * @param {Function} getDeployments - function to get deployments
 * @param {Filter} filter - filter to apply to deployments
 *
 * @returns {Array<Address>} - a list of checksummed addresses
 */
function formatDeployments(
  getDeployments:
    | typeof _getProxyFactoryDeployments
    | typeof _getSafeSingletonDeployments
    | typeof _getSafeL2SingletonDeployments
    | typeof _getMultiSendCallOnlyDeployments
    | typeof _getMultiSendDeployments
    | typeof _getSafeToL2MigrationDeployments,
  filter: Filter,
): Array<Address> {
  const deployments = getDeployments({
    network: filter.chainId,
    version: filter.version,
  });

  if (!deployments) {
    return [];
  }

  const chainDeployments = deployments.networkAddresses[filter.chainId];
  if (!chainDeployments) {
    return [];
  }

  // Note: can cast as deployment are inherently checksummed
  if (!Array.isArray(chainDeployments)) {
    return [chainDeployments as Address];
  }

  return chainDeployments as Array<Address>;
}

/**
 * Detects the Safe version from a mastercopy address.
 * Checks both L1 and L2 singleton deployments across all known versions.
 *
 * @param {string} chainId - the chain ID
 * @param {Address} mastercopyAddress - the mastercopy address to check
 *
 * @returns {string | null} - the Safe version if found, null otherwise
 */
export function getVersionFromMastercopy(
  chainId: string,
  mastercopyAddress: Address,
): string | null {
  const versions = ['1.4.1', '1.3.0', '1.2.0', '1.1.1', '1.0.0'];

  for (const version of versions) {
    const l1Singletons = getSafeSingletonDeployments({ chainId, version });
    const l2Singletons = getSafeL2SingletonDeployments({ chainId, version });

    const found =
      l1Singletons.some(
        (addr) => addr.toLowerCase() === mastercopyAddress.toLowerCase(),
      ) ||
      l2Singletons.some(
        (addr) => addr.toLowerCase() === mastercopyAddress.toLowerCase(),
      );

    if (found) {
      return version;
    }
  }

  return null;
}
