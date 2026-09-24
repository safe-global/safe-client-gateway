// SPDX-License-Identifier: FSL-1.1-MIT
import {
  getExtensibleFallbackHandlerDeployments as _getExtensibleFallbackHandlerDeployments,
  getCompatibilityFallbackHandlerDeployments as _getFallbackHandlerDeployments,
  getMultiSendCallOnlyDeployments as _getMultiSendCallOnlyDeployments,
  getMultiSendDeployments as _getMultiSendDeployments,
  getProxyFactoryDeployments as _getProxyFactoryDeployments,
  getSafeL2SingletonDeployments as _getSafeL2SingletonDeployments,
  getSafeMigrationDeployments as _getSafeMigrationDeployments,
  getSafeSingletonDeployments as _getSafeSingletonDeployments,
  getSafeToL2MigrationDeployments as _getSafeToL2MigrationDeployments,
  getSafeToL2SetupDeployments as _getSafeToL2SetupDeployments,
} from '@safe-global/safe-deployments';
import {
  _COMPAT_FALLBACK_HANDLER_DEPLOYMENTS,
  _EXTENSIBLE_FALLBACK_HANDLER_DEPLOYMENTS,
  _SAFE_DEPLOYMENTS,
  _SAFE_L2_DEPLOYMENTS,
  _SAFE_MIGRATION_DEPLOYMENTS,
  _SAFE_TO_L2_SETUP_DEPLOYMENTS,
} from '@safe-global/safe-deployments/dist/deployments';
import {
  getAllowanceModuleDeployment,
  getSafeWebAuthnSignerFactoryDeployment,
} from '@safe-global/safe-modules-deployments';
import { type Address, getAddress, type parseAbi } from 'viem';

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
  | typeof _getExtensibleFallbackHandlerDeployments
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
 * Type-only declaration of the Allowance Module functions the pending-policies
 * decoder depends on. Same rationale as {@link SignerFactoryAbi}: the runtime ABI
 * comes from `@safe-global/safe-modules-deployments`, typed `any[]` upstream, so
 * this self-declared shape is what gives viem's `AbiDecoder` a literal Abi to work
 * with. Verified against the package's actual ABI at load time by
 * {@link getAllowanceModuleAbi}.
 */
export type AllowanceModuleAbi = ReturnType<
  typeof parseAbi<
    [
      'function addDelegate(address delegate)',
      'function removeDelegate(address delegate, bool removeAllowances)',
      'function setAllowance(address delegate, address token, uint96 allowanceAmount, uint16 resetTimeMin, uint32 resetBaseMin)',
      'function resetAllowance(address delegate, address token)',
      'function deleteAllowance(address delegate, address token)',
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
 * Returns a list of official ExtensibleFallbackHandler addresses based on given {@link Filter}.
 *
 * @param {string} args.chainId - the chain ID to filter deployments by
 * @param {string} args.version - the version to filter deployments by
 *
 * @returns {Array<Address>} - a list of checksummed ExtensibleFallbackHandler addresses
 */
export function getExtensibleFallbackHandlerDeployments(
  args: Filter,
): Array<Address> {
  return formatDeployments(_getExtensibleFallbackHandlerDeployments, args);
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
 * Gets the list of ExtensibleFallbackHandler versions available in the safe-deployments package.
 * Infers versions from the _EXTENSIBLE_FALLBACK_HANDLER_DEPLOYMENTS constant exported by the package.
 * Note: ExtensibleFallbackHandler was introduced in Safe v1.5.0.
 *
 * @returns {Array<string>} - a list of extensible fallback handler versions in descending order
 */
export function getExtensibleFallbackHandlerVersions(): Array<string> {
  return _EXTENSIBLE_FALLBACK_HANDLER_DEPLOYMENTS.map(
    (deployment) => deployment.version,
  );
}

/**
 * Gets the list of SafeToL2Setup versions available in the safe-deployments package.
 * Infers versions from the _SAFE_TO_L2_SETUP_DEPLOYMENTS constant exported by the package.
 * Note: SafeToL2Setup was introduced in Safe v1.4.1.
 *
 * @returns {Array<string>} - a list of SafeToL2Setup versions in descending order
 */
export function getSafeToL2SetupVersions(): Array<string> {
  return _SAFE_TO_L2_SETUP_DEPLOYMENTS.map((deployment) => deployment.version);
}

/**
 * Gets the list of L1 singleton versions available in the safe-deployments package.
 * Infers versions from the _SAFE_DEPLOYMENTS constant exported by the package.
 * Note: includes legacy pre-1.3.0 versions (1.0.0, 1.1.1, 1.2.0) — callers feeding
 * these into version-sensitive flows (e.g. SafeTx hashing) must filter by range.
 *
 * @returns {Array<string>} - a list of L1 singleton versions in descending order
 */
export function getSafeSingletonVersions(): Array<string> {
  return _SAFE_DEPLOYMENTS.map((deployment) => deployment.version);
}

/**
 * Gets the list of L2 singleton versions available in the safe-deployments package.
 * Infers versions from the _SAFE_L2_DEPLOYMENTS constant exported by the package.
 * Note: the L2 singleton was introduced in Safe v1.3.0.
 *
 * @returns {Array<string>} - a list of L2 singleton versions in descending order
 */
export function getSafeL2SingletonVersions(): Array<string> {
  return _SAFE_L2_DEPLOYMENTS.map((deployment) => deployment.version);
}

/**
 * Gets the list of SafeMigration versions available in the safe-deployments package.
 * Infers versions from the _SAFE_MIGRATION_DEPLOYMENTS constant exported by the package.
 * Note: SafeMigration was introduced in Safe v1.4.1.
 *
 * @returns {Array<string>} - a list of SafeMigration versions in descending order
 */
export function getSafeMigrationVersions(): Array<string> {
  return _SAFE_MIGRATION_DEPLOYMENTS.map((deployment) => deployment.version);
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
 * Checks if a given address is deployed as an ExtensibleFallbackHandler.
 */
export const isExtensibleFallbackHandlerDeployed = (
  args: Filter & { address: Address },
): boolean => isDeployed(getExtensibleFallbackHandlerDeployments, args);

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

type AbiFunctionItem = {
  type?: string;
  name?: string;
  inputs?: ReadonlyArray<{ type?: string }>;
};

/**
 * Throws unless every entry of {@link required} has a matching function
 * signature in {@link abi}. Shared by every "load an ABI from
 * `@safe-global/safe-modules-deployments` and pin it to a self-declared type"
 * helper in this file - the package types `Deployment.abi` as `any[]`, so this
 * runtime check is what catches an upstream rename or removal that a type cast
 * alone would miss.
 */
function assertAbiHasFunctions(args: {
  abi: ReadonlyArray<AbiFunctionItem>;
  required: ReadonlyArray<{ name: string; inputs: ReadonlyArray<string> }>;
  contractLabel: string;
}): void {
  for (const required of args.required) {
    const match = args.abi.find(
      (item) => item.type === 'function' && item.name === required.name,
    );
    const inputTypes = match?.inputs?.map((i) => i.type) ?? [];
    const matches =
      inputTypes.length === required.inputs.length &&
      inputTypes.every((t, idx) => t === required.inputs[idx]);
    if (!matches) {
      throw new Error(
        `${args.contractLabel} ABI no longer matches the expected ${required.name}(${required.inputs.join(',')}) signature. The @safe-global/safe-modules-deployments package may have changed.`,
      );
    }
  }
}

/**
 * Returns the SafeWebAuthnSignerFactory ABI as published by
 * `@safe-global/safe-modules-deployments`, pinned to
 * {@link SUPPORTED_SIGNER_FACTORY_VERSION}. Throws if the package is missing
 * the deployment or if its ABI no longer contains the function signatures
 * encoded in {@link SignerFactoryAbi}.
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

  const abi = deployment.abi as ReadonlyArray<AbiFunctionItem>;
  assertAbiHasFunctions({
    abi,
    required: REQUIRED_SIGNER_FACTORY_FUNCTIONS,
    contractLabel: `SafeWebAuthnSignerFactory v${SUPPORTED_SIGNER_FACTORY_VERSION}`,
  });

  return abi as unknown as SignerFactoryAbi;
}

/**
 * Published Allowance Module versions, latest first - mirrors the order
 * `@safe-global/safe-modules-deployments` ships internally. The package exposes
 * no "every version" query, so this list is hand-maintained; add to it when a
 * new version is published upstream and should be treated as "known" here.
 */
const ALLOWANCE_MODULE_VERSIONS = ['0.1.1', '0.1.0'] as const;

/**
 * Returns every official Allowance Module address deployed on a chain, across
 * every published version.
 *
 * Unlike {@link getSignerFactoryDeployments}, this does not pin to one version:
 * the Allowance Module is not a same-address singleton, and a chain can run more
 * than one version at once with independent storage (see
 * `SpendingLimitPolicyData`), so "known" has to mean "any published version".
 */
export function getAllowanceModuleDeployments(args: {
  chainId: string;
}): Array<Address> {
  const addresses: Array<Address> = [];
  for (const version of ALLOWANCE_MODULE_VERSIONS) {
    const deployment = getAllowanceModuleDeployment({
      network: args.chainId,
      version,
    });
    const address = deployment?.networkAddresses[args.chainId];
    if (address) {
      addresses.push(getAddress(address));
    }
  }
  return addresses;
}

/**
 * Function signatures the pending-policies decoder depends on. Verified at
 * module load by {@link getAllowanceModuleAbi} so a future package release that
 * drops/renames one of them fails fast instead of silently.
 */
const REQUIRED_ALLOWANCE_MODULE_FUNCTIONS = [
  { name: 'addDelegate', inputs: ['address'] },
  { name: 'removeDelegate', inputs: ['address', 'bool'] },
  {
    name: 'setAllowance',
    inputs: ['address', 'address', 'uint96', 'uint16', 'uint32'],
  },
  { name: 'resetAllowance', inputs: ['address', 'address'] },
  { name: 'deleteAllowance', inputs: ['address', 'address'] },
] as const;

/**
 * Returns the Allowance Module ABI as published by
 * `@safe-global/safe-modules-deployments`. Function selectors are determined
 * solely by name and parameter types, which have been stable across every
 * published version, so the latest released version's ABI is used to decode
 * calls to any of them - there is no per-version decoder.
 */
export function getAllowanceModuleAbi(): AllowanceModuleAbi {
  const deployment = getAllowanceModuleDeployment();
  if (!deployment) {
    throw new Error(
      'Allowance Module deployment not found in @safe-global/safe-modules-deployments',
    );
  }

  const abi = deployment.abi as ReadonlyArray<AbiFunctionItem>;
  assertAbiHasFunctions({
    abi,
    required: REQUIRED_ALLOWANCE_MODULE_FUNCTIONS,
    contractLabel: 'Allowance Module',
  });

  return abi as unknown as AllowanceModuleAbi;
}
