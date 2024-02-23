import * as path from 'path';
import * as fs from 'fs';

/**
 * This generates a map of chain IDs to an array of versions for a given deployment
 * from the `@safe-global/safe-deployments` package.
 *
 * It is important to note that not all versions of a contract are deployed on all
 * chains and there is naming variation across versions.
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

const allDeploymentAliases = Object.values(deploymentAliases).flat();

// Path to directory containing JSON assets
const assetsDir = path.join(
  process.cwd(),
  'node_modules',
  '@safe-global',
  'safe-deployments',
  'dist',
  'assets',
);

function getDeploymentVersionsByChainId(
  contractAlias: keyof typeof deploymentAliases,
  chainId: string,
): Array<string> {
  const versionsByChain: Array<string> = [];

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

      // If there is a deployment on the given chain and the alias is known
      if (
        deployment.networkAddresses[chainId] &&
        deploymentAliases[contractAlias].includes(deployment.contractName)
      ) {
        versionsByChain.push(deployment.version);
      }
      // Else if the deployment is name is not mapped (is a new version alias)
      else if (!allDeploymentAliases.includes(deployment.contractName)) {
        throw new Error(`The ${test} contract alias is not known!`);
      }
    }
  }

  return versionsByChain;
}

export function getDeploymentVersionsByChainIds(
  contractAlias: keyof typeof deploymentAliases,
  chainIds: Array<string>,
): Record<string, Array<string>> {
  return chainIds.reduce<Record<string, Array<string>>>((acc, chainId) => {
    acc[chainId] = getDeploymentVersionsByChainId(contractAlias, chainId);
    return acc;
  }, {});
}
