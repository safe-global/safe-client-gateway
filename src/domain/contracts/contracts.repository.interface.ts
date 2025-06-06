import { Contract } from '@/domain/contracts/entities/contract.entity';
import { Module } from '@nestjs/common';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { Contract as DataDecodedContract } from '@/domain/data-decoder/v2/entities/contract.entity';
import { DataDecodedApiModule } from '@/datasources/data-decoder-api/data-decoder-api.module';

export const IContractsRepository = Symbol('IContractsRepository');

export interface IContractsRepository {
  /**
   * Gets the {@link Contract} associated with the {@link chainId} and the {@link contractAddress}.
   */
  getContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Contract>;

  /**
   * Gets the page containing {@link DataDecodedContract} associated with the {@link chainId} and the {@link contractAddress}.
   */
  getContracts(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Page<DataDecodedContract>>;

  /**
   * Determines if the contract at the {@link contractAddress} is trusted for delegate calls.
   */
  isTrustedForDelegateCall(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<boolean>;
}

@Module({
  imports: [TransactionApiManagerModule, DataDecodedApiModule],
  providers: [
    {
      provide: IContractsRepository,
      useClass: ContractsRepository,
    },
  ],
  exports: [IContractsRepository],
})
export class ContractsRepositoryModule {}
