import { IConfigurationService } from '@/config/configuration.service.interface';

export const FETCH_CLIENT = 'FetchClient';

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
) => Promise<{
  data: T;
}>;

/**
 * Use this factory to create a {@link FetchClient} instance
 * that can be used to make HTTP requests.
 */
export function fetchClientFactory(
  configurationService: IConfigurationService,
): FetchClient {
  const requestTimeout = configurationService.getOrThrow<number>(
    'httpClient.requestTimeout',
  );

  return async <T>(url: string, options: RequestInit): Promise<{ data: T }> => {
    // If general error - NetworkOtherError
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(requestTimeout),
      keepalive: true,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (!data) {
        // Response error (no response) - NetworkRequestError
        throw {
          request: new URL(url),
        };
      } else {
        // Response error - NetworkResponseError
        throw {
          response: {
            ...response,
            data,
          },
        };
      }
    }

    return {
      data: data as T,
    };
  };
}
