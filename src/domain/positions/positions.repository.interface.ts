import { Module } from '@nestjs/common';
import { PositionsRepository } from '@/domain/positions/positions.repository';
import { PositionsApiModule } from '@/datasources/positions-api/positions-api.module';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Position } from '@/domain/positions/entities/position.entity';

export const IPositionsRepository = Symbol('IPositionsRepository');

export interface IPositionsRepository {
  getPositions(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    fiatCode: string;
  }): Promise<Array<Position>>;

  clearPositions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
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
