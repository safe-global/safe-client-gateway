// SPDX-License-Identifier: FSL-1.1-MIT
import fs from 'node:fs';
import path from 'node:path';

/**
 * This generates a map of contract names to chain IDs to a versions array
 * from all deployments in the `@safe-global/safe-deployments` package.
 *
 * It is important to note that not all versions of a contract are deployed
 * on all chains and there is naming variation across versions.
 *
 * Note: if there is a contract update, the alias mapping may need updating.
 */

// All deployment name variations
const deploymentAliases = {
  CompatibilityFallbackHandler: [
    'CompatibilityFallbackHandler', // 1.3.0, 1.4.1
  ],
  ExtensibleFallbackHandler: [
    'ExtensibleFallbackHandler', // 1.5.0
  ],
  TokenCallbackHandler: [
    'TokenCallbackHandler', // 1.5.0
  ],
  CreateCall: [
    'CreateCall', // 1.3.0, 1.4.1
  ],
  DefaultCallbackHandler: [
    'DefaultCallbackHandler', // 1.1.1
  ],
  MultiSend: [
    'MultiSend', // 1.3.0, 1.4.1
  ],
  MultiSendCallOnly: [
    'MultiSendCallOnly', // 1.3.0, 1.4.1
  ],
  ProxyFactory: [
    'ProxyFactory', // 1.0.0, 1.1.1
    'GnosisSafeProxyFactory', // 1.3.0
    'SafeProxyFactory', // 1.4.1
  ],
  Safe: [
    'GnosisSafe', // 1.0.0, 1.1.1, 1.2.0, 1.3.0
    'Safe', // 1.4.1
  ],
  SafeL2: [
    'GnosisSafeL2', // 1.3.0
    'SafeL2', // 1.4.1
  ],
  SafeMigration: [
    'SafeMigration', // 1.4.1
  ],
  SafeToL2Migration: [
    'SafeToL2Migration', // 1.4.1
  ],
  SafeToL2Setup: [
    'SafeToL2Setup', // 1.4.1
  ],
  SignMessageLib: [
    'SignMessageLib', // 1.3.0, 1.4.1
  ],
  SimulateTxAccessor: [
    'SimulateTxAccessor', // 1.3.0, 1.4.1
  ],
};

// Path to directory containing JSON assets
const assetsDir = path.join(
  process.cwd(),
  'node_modules',
  '@safe-global',
  'safe-deployments',
  'dist',
  'assets',
);

type VersionsByChainIdByDeploymentMap = {
  [contractAlias: string]: { [chainId: string]: Array<string> | undefined };
};

export function getVersionsByChainIdByDeploymentMap(): VersionsByChainIdByDeploymentMap {
  const versionsByDeploymentByChainId: VersionsByChainIdByDeploymentMap = {};

  // Initialize map
  for (const contractName of Object.keys(deploymentAliases)) {
    versionsByDeploymentByChainId[contractName] = {};
  }

  // For each version...
  for (const version of fs.readdirSync(assetsDir)) {
    const versionDir = path.join(assetsDir, version);

    // ...parse each asset
    for (const assetFile of fs.readdirSync(versionDir)) {
      // Read the asset JSON
      const assetPath = path.join(assetsDir, version, assetFile);
      const assetJson = fs.readFileSync(assetPath, 'utf8');

      // Parse the asset JSON
      const deployment = JSON.parse(assetJson);

      // Get the alias name
      const name = Object.entries(deploymentAliases).find(([, aliases]) =>
        aliases.includes(deployment.contractName as string),
      )?.[0];

      if (!name) {
        throw new Error(
          `The ${deployment.contractName} contract alias is not known!`,
        );
      }

      // Add the version to the map
      for (const chainId of Object.keys(
        deployment.networkAddresses as Record<string, string>,
      )) {
        versionsByDeploymentByChainId[name][chainId] ??= [];
        versionsByDeploymentByChainId[name][chainId]?.push(
          deployment.version as string,
        );
      }
    }
  }

  return versionsByDeploymentByChainId;
}

const versionsByDeploymentByChainId = getVersionsByChainIdByDeploymentMap();

export function getDeploymentVersionsByChainIds(
  contractAlias: keyof typeof deploymentAliases,
  chainIds: Array<string>,
): Record<string, Array<string>> {
  return chainIds.reduce<Record<string, Array<string>>>((acc, chainId) => {
    acc[chainId] = versionsByDeploymentByChainId[contractAlias][chainId] ?? [];
    return acc;
  }, {});
}

/**
 * Chain IDs used across relay tests to build deployment fixtures. Previously
 * derived from `relay.apiKey` (one key per chain); that config is now a single
 * project-level key, so relay tests reference this explicit list instead. The
 * runtime relay chain gate is the chain's `relayer.type` (from ChainsRepository),
 * not this list.
 */
export const RELAY_SUPPORTED_CHAIN_IDS: Array<string> = [
  '1', // Ethereum Mainnet
  '10', // Optimism
  '56', // BNB
  '100', // Gnosis
  '130', // Unichain
  '137', // Polygon
  '1101', // Polygon zkEVM
  '8453', // Base
  '42161', // Arbitrum
  '43114', // Avalanche
  '59144', // Linea
  '81457', // Blast
  '11155111', // Sepolia
];
