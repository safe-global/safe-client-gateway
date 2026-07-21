// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { getServiceAuthHeaders } from '@/datasources/network/auth/service-auth-headers.helper';

/**
 * Returns Queue Service auth headers when running in development
 * against the public Queue Service.
 *
 * @param configurationService - Configuration service used to read settings
 * @returns An object containing the `Authorization` header (`{ Authorization: `Bearer ${apiKey}` }`)
 *          when Queue auth is enabled and an API key is configured; otherwise `undefined`.
 */
export function getQueueAuthHeaders(
  configurationService: IConfigurationService,
): Record<string, string> | undefined {
  return getServiceAuthHeaders(configurationService, {
    useVpcUrlKey: 'queueService.useVpcUrl',
    apiKeyKey: 'queueService.apiKey',
  });
}
