import { Balance } from './balance.entity';

export interface Balances {
  fiatTotal: number;
  items: Balance[];
}
