import { Module } from '@nestjs/common';
import { ContractsRepository } from '@/modules/contracts/domain/contracts.repository';
import type { Contract } from '@/modules/data-decoder/domain/v2/entities/contract.entity';
import { DataDecodedApiModule } from '@/modules/data-decoder/datasources/data-decoder-api.module';
import type { Address } from 'viem';

export const IContractsRepository = Symbol('IContractsRepository');

export interface IContractsRepository {
  /**
   * Gets the {@link Contract} associated with the {@link chainId} and the {@link contractAddress}.
   */
  getContract(args: {
    chainId: string;
    contractAddress: Address;
  }): Promise<Contract>;

  /**
   * Determines if the contract at the {@link contractAddress} is trusted for delegate calls.
   */
  isTrustedForDelegateCall(args: {
    chainId: string;
    contractAddress: Address;
  }): Promise<boolean>;
}

@Module({
  imports: [DataDecodedApiModule],
  providers: [
    {
      provide: IContractsRepository,
      useClass: ContractsRepository,
    },
  ],
  exports: [IContractsRepository],
})
export class ContractsRepositoryModule {}
