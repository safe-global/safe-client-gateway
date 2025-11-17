import { DataDecoded } from '@/modules/data-decoder/domain/v1/entities/data-decoded.entity';
import { Module } from '@nestjs/common';
import { DataDecodedRepository } from '@/modules/data-decoder/domain/v1/data-decoded.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Address } from 'viem';

export const IDataDecodedRepository = Symbol('IDataDecodedRepository');

export interface IDataDecodedRepository {
  /**
   * Gets the {@link DataDecoded} associated with {@link chainId} the for the {@link data}
   * and the address pointed by {@link to}.
   */
  getDataDecoded(args: {
    chainId: string;
    data: Address;
    to?: Address;
  }): Promise<DataDecoded>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IDataDecodedRepository,
      useClass: DataDecodedRepository,
    },
  ],
  exports: [IDataDecodedRepository],
})
export class DataDecodedRepositoryModule {}
