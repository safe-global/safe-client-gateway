// eslint-disable-next-line no-restricted-imports
import {
  getMultiSendCallOnlyDeployments as _getMultiSendCallOnlyDeployments,
  getMultiSendDeployments as _getMultiSendDeployments,
  getProxyFactoryDeployments as _getProxyFactoryDeployments,
  getSafeL2SingletonDeployments as _getSafeL2SingletonDeployments,
  getSafeSingletonDeployments as _getSafeSingletonDeployments,
} from '@safe-global/safe-deployments';

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
 * @returns {Array<`0x${string}`>} - a list of checksummed ProxyFactory addresses
 */
export function getProxyFactoryDeployments(args: Filter): Array<`0x${string}`> {
  return formatDeployments(_getProxyFactoryDeployments, args);
}

/**
 * Returns a list of official L1 singleton addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<`0x${string}`>} - a list of checksummed L1 singleton addresses
 */
export function getSafeSingletonDeployments(
  args: Filter,
): Array<`0x${string}`> {
  return formatDeployments(_getSafeSingletonDeployments, args);
}

/**
 * Returns a list of official L2 singleton addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<`0x${string}`>} - a list of checksummed L2 singleton addresses
 */
export function getSafeL2SingletonDeployments(
  args: Filter,
): Array<`0x${string}`> {
  return formatDeployments(_getSafeL2SingletonDeployments, args);
}

/**
 * Returns a list of official MultiSendCallOnly addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<`0x${string}`>} - a list of checksummed MultiSendCallOnly addresses
 */
export function getMultiSendCallOnlyDeployments(
  args: Filter,
): Array<`0x${string}`> {
  return formatDeployments(_getMultiSendCallOnlyDeployments, args);
}

/**
 * Returns a list of official MultiSend addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<`0x${string}`>} - a list of checksummed MultiSend addresses
 */
export function getMultiSendDeployments(args: Filter): Array<`0x${string}`> {
  return formatDeployments(_getMultiSendDeployments, args);
}

/**
 * Helper to remap {@link SingletonDeploymentV2} to a list of checksummed addresses.
 *
 * @param {Function} getDeployments - function to get deployments
 * @param {Filter} filter - filter to apply to deployments
 *
 * @returns {Array<`0x${string}`>} - a list of checksummed addresses
 */
function formatDeployments(
  getDeployments:
    | typeof _getProxyFactoryDeployments
    | typeof _getSafeSingletonDeployments
    | typeof _getSafeL2SingletonDeployments
    | typeof _getMultiSendCallOnlyDeployments
    | typeof _getMultiSendDeployments,
  filter: Filter,
): Array<`0x${string}`> {
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
    return [chainDeployments as `0x${string}`];
  }

  return chainDeployments as Array<`0x${string}`>;
}
