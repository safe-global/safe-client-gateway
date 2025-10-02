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
} from '@safe-global/safe-deployments';
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
  | typeof _getFallbackHandlerDeployments;

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
