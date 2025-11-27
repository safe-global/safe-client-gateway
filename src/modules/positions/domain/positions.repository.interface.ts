import { Module } from '@nestjs/common';
import { PositionsRepository } from '@/modules/positions/domain/positions.repository';
import { PositionsApiModule } from '@/modules/positions/datasources/positions-api.module';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { Position } from '@/modules/positions/domain/entities/position.entity';
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
