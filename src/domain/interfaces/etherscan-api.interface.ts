import type { GasPriceResponse } from '@/modules/chains/routes/entities/gas-price-response.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IEtherscanApi = Symbol('IEtherscanApi');

export interface IEtherscanApi {
  /**
   * Gets the gas price from Etherscan Gas Oracle API
   *
   * @param chainId - the chain ID to fetch gas price for
   */
  getGasPrice(chainId: string): Promise<Raw<GasPriceResponse>>;
}
