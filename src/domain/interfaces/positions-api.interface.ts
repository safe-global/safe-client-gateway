import type { Position } from '@/domain/positions/entities/position.entity';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IPositionsApi = Symbol('IPositionsApi');

export interface IPositionsApi {
  getPositions(args: {
    safeAddress: `0x${string}`;
    fiatCode: string;
    chain: Chain;
  }): Promise<Raw<Array<Position>>>;

  clearPositions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
