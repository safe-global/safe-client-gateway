import { Module } from '@nestjs/common';
import { PositionsRepository } from '@/domain/positions/positions.repository';
import { PositionsApiModule } from '@/datasources/positions-api/positions-api.module';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Position } from '@/domain/positions/entities/position.entity';
import type { Address } from 'viem';

export const IPositionsRepository = Symbol('IPositionsRepository');

export interface IPositionsRepository {
  getPositions(args: {
    chain: Chain;
    safeAddress: Address;
    fiatCode: string;
    refresh?: string;
  }): Promise<Array<Position>>;

  clearPositions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getFiatCodes(): Promise<Array<string>>;
}

@Module({
  imports: [PositionsApiModule],
  providers: [
    {
      provide: IPositionsRepository,
      useClass: PositionsRepository,
    },
  ],
  exports: [IPositionsRepository],
})
export class PositionsRepositoryModule {}
