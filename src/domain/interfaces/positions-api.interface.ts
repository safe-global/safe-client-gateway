import type { Position } from '@/modules/positions/domain/entities/position.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const IPositionsApi = Symbol('IPositionsApi');

export interface IPositionsApi {
  getPositions(args: {
    safeAddress: Address;
    fiatCode: string;
    chain: Chain;
    refresh?: string;
  }): Promise<Raw<Array<Position>>>;

  clearPositions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
