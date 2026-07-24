// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Returns auth headers for a downstream service when running in development
 * against its public instance (i.e. not through the VPC).
 *
 * @param configurationService - Configuration service used to read settings
 * @param keys.useVpcUrlKey - Configuration key holding the service's `useVpcUrl` flag
 * @param keys.apiKeyKey - Configuration key holding the service's API key
 * @returns An object containing the `Authorization` header (`{ Authorization: `Bearer ${apiKey}` }`)
 *          when auth is enabled and an API key is configured; otherwise `undefined`.
 */
export function getServiceAuthHeaders(
  configurationService: IConfigurationService,
  keys: { useVpcUrlKey: string; apiKeyKey: string },
): Record<string, string> | undefined {
  const isDevelopment = configurationService.getOrThrow<boolean>(
    'application.isDevelopment',
  );
  const useVpcUrl = configurationService.getOrThrow<boolean>(keys.useVpcUrlKey);
  const apiKey = configurationService.get<string | undefined>(keys.apiKeyKey);

  const isAuthEnabled = isDevelopment && !useVpcUrl;
  if (!(isAuthEnabled && apiKey)) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
