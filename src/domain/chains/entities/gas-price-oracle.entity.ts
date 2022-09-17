import { GasPrice } from './gas-price.entity';

export interface GasPriceOracle extends GasPrice {
  type: 'oracle';
  uri: string;
  gasParameter: string;
  gweiFactor: number;
}
