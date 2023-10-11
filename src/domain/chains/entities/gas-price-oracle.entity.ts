import { GasPrice } from '@/domain/chains/entities/gas-price.entity';

export interface GasPriceOracle extends GasPrice {
  type: 'oracle';
  uri: string;
  gasParameter: string;
  gweiFactor: string;
}
