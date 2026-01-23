import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Position } from '@/modules/positions/domain/entities/position.entity';
import type { Address } from 'viem';

export const IPositionsRepository = Symbol('IPositionsRepository');

export interface IPositionsRepository {
  getPositions(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    refresh?: string;
    sync?: boolean;
  }): Promise<Array<Position>>;

  clearPositions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getFiatCodes(): Promise<Array<string>>;
}
