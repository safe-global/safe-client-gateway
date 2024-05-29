import { Contract } from '@/domain/contracts/entities/contract.entity';
import { Module } from '@nestjs/common';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IContractsRepository = Symbol('IContractsRepository');

export interface IContractsRepository {
  /**
   * Gets the {@link Contract} associated with the {@link chainId} and the {@link contractAddress}.
   */
  getContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Contract>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IContractsRepository,
      useClass: ContractsRepository,
    },
  ],
  exports: [IContractsRepository],
})
export class ContractsRepositoryModule {}
