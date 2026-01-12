import type { ZerionBalance } from './entities/zerion-balance.entity';
import { PositionType } from '@/modules/positions/domain/entities/position-type.entity';

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

/**
 * Negates fiat values for loan positions (debt should be negative).
 *
 * @param balances - Array of ZerionBalance objects from Zerion API
 * @returns New array with loan fiat values negated
 */
export function normalizeZerionBalances(
  balances: Array<ZerionBalance>,
): Array<ZerionBalance> {
  return balances.map((balance) => {
    const isLoan = balance.attributes.position_type === PositionType.loan;

    if (!isLoan || balance.attributes.value === null) {
      return balance;
    }

    return {
      ...balance,
      attributes: {
        ...balance.attributes,
        value: -balance.attributes.value,
      },
    };
  });
}
