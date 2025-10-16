// eslint-disable-next-line no-restricted-imports
import {
  getMultiSendCallOnlyDeployments as _getMultiSendCallOnlyDeployments,
  getMultiSendDeployments as _getMultiSendDeployments,
  getProxyFactoryDeployments as _getProxyFactoryDeployments,
  getSafeL2SingletonDeployments as _getSafeL2SingletonDeployments,
  getSafeSingletonDeployments as _getSafeSingletonDeployments,
  getCompatibilityFallbackHandlerDeployments as _getFallbackHandlerDeployments,
  getSafeToL2SetupDeployments as _getSafeToL2SetupDeployments,
  getSafeToL2MigrationDeployments as _getSafeToL2MigrationDeployments,
  getSafeMigrationDeployments as _getSafeMigrationDeployments,
} from '@safe-global/safe-deployments';
import { _SAFE_DEPLOYMENTS } from '@safe-global/safe-deployments/dist/deployments';
import { getAddress, type Address } from 'viem';

type Filter = {
  chainId: string;
  version: string;
};

type DeploymentGetter =
  | typeof _getProxyFactoryDeployments
  | typeof _getSafeSingletonDeployments
  | typeof _getSafeL2SingletonDeployments
  | typeof _getMultiSendCallOnlyDeployments
  | typeof _getMultiSendDeployments
  | typeof _getFallbackHandlerDeployments
  | typeof _getSafeToL2SetupDeployments
  | typeof _getSafeToL2MigrationDeployments;

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
 * Returns a list of official CompatibilityFallbackHandler addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed CompatibilityFallbackHandler addresses
 */
export function getFallbackHandlerDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getFallbackHandlerDeployments, args);
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
 * Returns a list of official SafeMigration addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed SafeMigration addresses
 */
export function getSafeMigrationDeployments(args: Filter): Array<Address> {
  return formatDeployments(_getSafeMigrationDeployments, args);
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
  getDeployments: DeploymentGetter,
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
 * Gets the list of Safe versions available in the safe-deployments package.
 * Infers versions from the _SAFE_DEPLOYMENTS constant exported by the package.
 *
 * @returns {Array<string>} - a list of Safe versions in descending order
 */
function getSafeVersions(): Array<string> {
  return _SAFE_DEPLOYMENTS.map((deployment) => deployment.version);
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
  const versions = getSafeVersions();

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

/**
 * Checks if a given address is deployed as a canonical deployment.
 *
 * @param {Function} getDeployments - function to get deployments
 * @param {Filter} filter - filter to apply to deployments
 * @returns {boolean} - true if the address is deployed as a canonical deployment, false otherwise.
 */
export const hasCanonicalDeployment = (
  getDeployments: DeploymentGetter,
  filter: Filter,
): boolean => {
  const { deployments } = getDeployments(filter) || {};
  const canonicalAddress = deployments?.canonical?.address;
  const networkAddresses = formatDeployments(getDeployments, filter);

  return (
    !!canonicalAddress &&
    networkAddresses.includes(getAddress(canonicalAddress))
  );
};

/**
 * Checks if there is a canonical deployment of SafeToL2Setup on a given chain and version.
 */
export const hasCanonicalDeploymentSafeToL2Setup = (args: Filter): boolean =>
  hasCanonicalDeployment(_getSafeToL2SetupDeployments, args);

/**
 * Checks if there is a canonical deployment of SafeToL2Migration on a given chain and version.
 */
export const hasCanonicalDeploymentSafeToL2Migration = (
  args: Filter,
): boolean => hasCanonicalDeployment(_getSafeToL2MigrationDeployments, args);

/**
 * Generic helper to check if a given address is deployed.
 */
function isDeployed(
  getDeploymentsFn: (args: Filter) => Array<Address>,
  args: Filter & { address: Address },
): boolean {
  const deployments = getDeploymentsFn(args);
  return deployments.includes(args.address);
}

/**
 * Checks if a given address is deployed as an L1 singleton.
 */
export const isL1SingletonDeployed = (
  args: Filter & { address: Address },
): boolean => isDeployed(getSafeSingletonDeployments, args);

/**
 * Checks if a given address is deployed as an L2 singleton.
 */
export const isL2SingletonDeployed = (
  args: Filter & { address: Address },
): boolean => isDeployed(getSafeL2SingletonDeployments, args);

/**
 * Checks if a given address is deployed as a ProxyFactory.
 */
export const isProxyFactoryDeployed = (
  args: Filter & { address: Address },
): boolean => isDeployed(getProxyFactoryDeployments, args);

/**
 * Checks if a given address is deployed as a CompatibilityFallbackHandler.
 */
export const isFallbackHandlerDeployed = (
  args: Filter & { address: Address },
): boolean => isDeployed(getFallbackHandlerDeployments, args);
