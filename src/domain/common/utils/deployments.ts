// SPDX-License-Identifier: FSL-1.1-MIT
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
// eslint-disable-next-line no-restricted-imports
import { getSafeWebAuthnSignerFactoryDeployment } from '@safe-global/safe-modules-deployments';
import {
  _SAFE_DEPLOYMENTS,
  _COMPAT_FALLBACK_HANDLER_DEPLOYMENTS,
} from '@safe-global/safe-deployments/dist/deployments';
import { getAddress, type Address, type parseAbi } from 'viem';

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
 * Type-only declaration of the SafeWebAuthnSignerFactory function signatures
 * that the relay limit logic depends on. The runtime ABI is loaded from
 * `@safe-global/safe-modules-deployments` by `getSignerFactoryAbi`; this type
 * exists solely to give viem the literal Abi shape needed for typed helpers
 * (e.g. `helpers.isCreateSigner`).
 *
 * Note: this is a self-declared shape, not derived from the package's types
 * (the package types `Deployment.abi` as `any[]`). Tests guard against the
 * runtime selectors drifting; type-level drift is not caught.
 */
export type SignerFactoryAbi = ReturnType<
  typeof parseAbi<
    [
      'function createSigner(uint256 x, uint256 y, uint176 verifiers) returns (address signer)',
      'function getSigner(uint256 x, uint256 y, uint176 verifiers) view returns (address signer)',
    ]
  >
>;

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
 * Gets the list of CompatibilityFallbackHandler versions available in the safe-deployments package.
 * Infers versions from the _COMPAT_FALLBACK_HANDLER_DEPLOYMENTS constant exported by the package.
 * Note: CompatibilityFallbackHandler was introduced in Safe v1.3.0.
 *
 * @returns {Array<string>} - a list of fallback handler versions in descending order
 */
export function getFallbackHandlerVersions(): Array<string> {
  return _COMPAT_FALLBACK_HANDLER_DEPLOYMENTS.map(
    (deployment) => deployment.version,
  );
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

/**
 * The SafeWebAuthnSignerFactory contract version supported by the relay.
 *
 * Pinned explicitly so that a future package release adding e.g. v0.3.0 does
 * not silently change which factory addresses we accept (the package's
 * `findDeployment` picks the latest released version when no filter is
 * supplied). Bump this constant deliberately when adding support for a new
 * factory version, after verifying the function signatures are unchanged or
 * updating `SignerFactoryAbi` accordingly.
 */
const SUPPORTED_SIGNER_FACTORY_VERSION = '0.2.1';

/**
 * Returns a list of official SafeWebAuthnSignerFactory addresses for a chain.
 * Uses @safe-global/safe-modules-deployments (separate from core safe-deployments).
 *
 * Pinned to {@link SUPPORTED_SIGNER_FACTORY_VERSION}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @returns {Array<Address>} - a list of checksummed factory addresses
 */
export function getSignerFactoryDeployments(args: {
  chainId: string;
}): Array<Address> {
  const deployment = getSafeWebAuthnSignerFactoryDeployment({
    network: args.chainId,
    version: SUPPORTED_SIGNER_FACTORY_VERSION,
  });
  if (!deployment) return [];
  const address = deployment.networkAddresses[args.chainId];
  if (!address) return [];
  return [getAddress(address)];
}

/**
 * Function signatures we type-cast the upstream ABI to in {@link SignerFactoryAbi}.
 * Verified at module load by {@link getSignerFactoryAbi} so a future package
 * release that drops/renames a function fails fast instead of silently.
 */
const REQUIRED_SIGNER_FACTORY_FUNCTIONS = [
  { name: 'createSigner', inputs: ['uint256', 'uint256', 'uint176'] },
  { name: 'getSigner', inputs: ['uint256', 'uint256', 'uint176'] },
] as const;

/**
 * Returns the SafeWebAuthnSignerFactory ABI as published by
 * `@safe-global/safe-modules-deployments`, pinned to
 * {@link SUPPORTED_SIGNER_FACTORY_VERSION}. Throws if the package is missing
 * the deployment or if its ABI no longer contains the function signatures
 * encoded in {@link SignerFactoryAbi}.
 *
 * The runtime check guards against silent drift: the package types
 * `Deployment.abi` as `any[]`, so the type cast can't catch upstream changes
 * by itself.
 */
export function getSignerFactoryAbi(): SignerFactoryAbi {
  const deployment = getSafeWebAuthnSignerFactoryDeployment({
    version: SUPPORTED_SIGNER_FACTORY_VERSION,
  });
  if (!deployment) {
    throw new Error(
      `SafeWebAuthnSignerFactory v${SUPPORTED_SIGNER_FACTORY_VERSION} deployment not found in @safe-global/safe-modules-deployments`,
    );
  }

  type AbiFunctionItem = {
    type?: string;
    name?: string;
    inputs?: ReadonlyArray<{ type?: string }>;
  };
  const abi = deployment.abi as ReadonlyArray<AbiFunctionItem>;
  for (const required of REQUIRED_SIGNER_FACTORY_FUNCTIONS) {
    const match = abi.find(
      (item) => item.type === 'function' && item.name === required.name,
    );
    const inputTypes = match?.inputs?.map((i) => i.type) ?? [];
    const matches =
      inputTypes.length === required.inputs.length &&
      inputTypes.every((t, idx) => t === required.inputs[idx]);
    if (!matches) {
      throw new Error(
        `SafeWebAuthnSignerFactory v${SUPPORTED_SIGNER_FACTORY_VERSION} ABI no longer matches the expected ${required.name}(${required.inputs.join(',')}) signature. The @safe-global/safe-modules-deployments package may have changed; update SignerFactoryAbi and SUPPORTED_SIGNER_FACTORY_VERSION accordingly.`,
      );
    }
  }

  return abi as unknown as SignerFactoryAbi;
}
