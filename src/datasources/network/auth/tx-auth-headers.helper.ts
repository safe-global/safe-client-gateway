import type { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Returns Transaction Service auth headers when running in development
 * against the public Transaction Service.
 *
 * @param configurationService - Configuration service used to read settings
 * @returns An object containing the `Authorization` header (`{ Authorization: `Bearer ${apiKey}` }`)
 *          when TX auth is enabled and an API key is configured; otherwise `undefined`.
 */
export function getTxAuthHeaders(
  configurationService: IConfigurationService,
): Record<string, string> | undefined {
  const isDevelopment = configurationService.getOrThrow<boolean>(
    'application.isDevelopment',
  );
  const useVpcUrl = configurationService.getOrThrow<boolean>(
    'safeTransaction.useVpcUrl',
  );
  const apiKey = configurationService.get<string | undefined>(
    'safeTransaction.apiKey',
  );

  const isTxAuthEnabled = isDevelopment && !useVpcUrl;
  if (!isTxAuthEnabled || !apiKey) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
