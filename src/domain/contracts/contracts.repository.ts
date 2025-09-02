import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import type { Address } from 'viem';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import {
  Contract,
  ContractPageSchema,
} from '@/domain/data-decoder/v2/entities/contract.entity';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  private readonly isTrustedForDelegateCallContractsListEnabled: boolean;
  private readonly maxSequentialPages: number;

  constructor(
    @Inject(IDataDecoderApi)
    private readonly dataDecoderApi: IDataDecoderApi,
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
    contractAddress: Address;
  }): Promise<Contract> {
    const contracts = await this.dataDecoderApi.getContracts({
      address: args.contractAddress,
      chainId: args.chainId,
    });
    const { count, results } = ContractPageSchema.parse(contracts);
    if (count === 0) {
      throw new NotFoundException('Error fetching the contract data.');
    }
    // We fetch index 0 as the Decoder API returns a page with a single contract for a given address and chainId
    return results[0];
  }

  async isTrustedForDelegateCall(args: {
    chainId: string;
    contractAddress: Address;
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

    for (let i = 0; i < this.maxSequentialPages; i++) {
      const result =
        await this.dataDecoderApi.getTrustedForDelegateCallContracts({
          chainId,
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
    contractAddress: Address;
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
    contractAddress: Address;
  }): Promise<boolean> {
    const contract = await this.getContract({
      chainId: args.chainId,
      contractAddress: args.contractAddress,
    });
    return contract.trustedForDelegateCall;
  }
}
