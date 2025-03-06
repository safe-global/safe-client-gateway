import { Inject, Injectable } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  ContractPageSchema,
  ContractSchema,
} from '@/domain/contracts/entities/schemas/contract.schema';
import { Page } from '@/domain/entities/page.entity';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  private readonly isTrustedForDelegateCallContractsListEnabled: boolean;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isTrustedForDelegateCallContractsListEnabled =
      this.configurationService.getOrThrow(
        'features.trustedForDelegateCallContractsList',
      );
  }

  async getContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Contract> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    const data = await api.getContract(args.contractAddress);
    return ContractSchema.parse(data);
  }

  async isTrustedForDelegateCall(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<boolean> {
    return this.isTrustedForDelegateCallContractsListEnabled
      ? await this.isIncludedInTrustedForDelegateCallContractsList({
          chainId: args.chainId,
          contractAddress: args.contractAddress,
        })
      : await this.isTrustedForDelegateCallContract({
          chainId: args.chainId,
          contractAddress: args.contractAddress,
        });
  }

  private async getTrustedForDelegateCallContracts(
    chainId: string,
  ): Promise<Page<Contract>> {
    const api = await this.transactionApiManager.getApi(chainId);
    const contracts = await api.getTrustedForDelegateCallContracts();
    return ContractPageSchema.parse(contracts);
  }

  private async isIncludedInTrustedForDelegateCallContractsList(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<boolean> {
    const trustedContracts = await this.getTrustedForDelegateCallContracts(
      args.chainId,
    );
    return trustedContracts.results.some((contract) =>
      isAddressEqual(contract.address, args.contractAddress),
    );
  }

  private async isTrustedForDelegateCallContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<boolean> {
    const contract = await this.getContract({
      chainId: args.chainId,
      contractAddress: args.contractAddress,
    });
    return contract.trustedForDelegateCall;
  }
}
