import * as path from 'path';
import * as fs from 'fs';

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
  [contractAlias: string]: { [chainId: string]: string[] | undefined };
};

let versionsByDeploymentByChainIdSingleton: VersionsByChainIdByDeploymentMap | null;

export function getVersionsByChainIdByDeploymentMap(): VersionsByChainIdByDeploymentMap {
  // If previously computed, return the singleton
  if (versionsByDeploymentByChainIdSingleton) {
    return versionsByDeploymentByChainIdSingleton;
  }

  // Initialize map
  versionsByDeploymentByChainIdSingleton = {};
  for (const contractName of Object.keys(deploymentAliases)) {
    versionsByDeploymentByChainIdSingleton[contractName] = {};
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
      const name = Object.entries(deploymentAliases).find(([, aliases]) => {
        return aliases.includes(deployment.contractName);
      })?.[0];

      if (!name) {
        throw new Error(
          `The ${deployment.contractName} contract alias is not known!`,
        );
      }

      // Add the version to the map
      for (const chainId of Object.keys(deployment.networkAddresses)) {
        versionsByDeploymentByChainIdSingleton[name][chainId] ??= [];
        versionsByDeploymentByChainIdSingleton[name][chainId]?.push(
          deployment.version,
        );
      }
    }
  }

  return versionsByDeploymentByChainIdSingleton;
}

export function getDeploymentVersionsByChainIds(
  contractAlias: keyof typeof deploymentAliases,
  chainIds: Array<string>,
): Record<string, Array<string>> {
  const map = getVersionsByChainIdByDeploymentMap();
  return chainIds.reduce<Record<string, Array<string>>>((acc, chainId) => {
    acc[chainId] = map[contractAlias][chainId] ?? [];
    return acc;
  }, {});
}
