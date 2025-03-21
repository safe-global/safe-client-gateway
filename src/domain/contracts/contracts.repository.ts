import { Inject, Injectable } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  ContractPageSchema,
  ContractSchema,
} from '@/domain/contracts/entities/schemas/contract.schema';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  private readonly isTrustedForDelegateCallContractsListEnabled: boolean;
  private readonly maxSequentialPages: number;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.isTrustedForDelegateCallContractsListEnabled =
      this.configurationService.getOrThrow(
        'features.trustedForDelegateCallContractsList',
      );
    this.maxSequentialPages = this.configurationService.getOrThrow<number>(
      'contracts.trustedForDelegateCall.maxSequentialPages',
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
  ): Promise<Array<Contract>> {
    const contracts: Array<Contract> = [];

    let offset = 0;
    let next = null;
    const api = await this.transactionApiManager.getApi(chainId);

    for (let i = 0; i < this.maxSequentialPages; i++) {
      const result = await api.getTrustedForDelegateCallContracts({
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset,
      });
      const page = ContractPageSchema.parse(result);
      next = page.next;
      contracts.push(...page.results);

      if (!next) {
        break;
      }

      const url = new URL(next);
      const paginationData = PaginationData.fromLimitAndOffset(url);
      offset = paginationData.offset;

      if (i === this.maxSequentialPages - 1) {
        this.loggingService.error({
          message: 'Max sequential pages reached',
          chainId,
          next,
        });
      }
    }

    return contracts;
  }

  private async isIncludedInTrustedForDelegateCallContractsList(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<boolean> {
    const trustedContracts = await this.getTrustedForDelegateCallContracts(
      args.chainId,
    );
    return trustedContracts.some(
      (contract) =>
        isAddressEqual(contract.address, args.contractAddress) &&
        contract.trustedForDelegateCall,
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
