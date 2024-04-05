import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { Module } from '@nestjs/common';
import { DataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IDataDecodedRepository = Symbol('IDataDecodedRepository');

export interface IDataDecodedRepository {
  /**
   * Gets the {@link DataDecoded} associated with {@link chainId} the for the {@link data}
   * and the address pointed by {@link to}.
   */
  getDataDecoded(args: {
    chainId: string;
    data: `0x${string}`;
    to?: `0x${string}`;
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
