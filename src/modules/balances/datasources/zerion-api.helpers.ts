/**
 * Builds headers for Zerion API requests.
 * Includes X-Env: testnet header when querying testnet chains.
 *
 * @param apiKey - Zerion API key (base64 encoded)
 * @param isTestnet - Whether the request is for testnet chains
 * @returns Headers object for the request
 */
export function getZerionHeaders(
  apiKey: string | undefined,
  isTestnet: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${apiKey}`,
  };
  if (isTestnet) {
    headers['X-Env'] = 'testnet';
  }
  return headers;
}
