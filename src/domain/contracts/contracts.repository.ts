import { Inject, Injectable } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  ContractPageSchema,
  ContractSchema,
} from '@/domain/contracts/entities/schemas/contract.schema';
import { Page } from '@/domain/entities/page.entity';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getContract(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): Promise<Contract> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    const data = await api.getContract(args.contractAddress);
    return ContractSchema.parse(data);
  }

  async getTrustedForDelegateCallContracts(
    chainId: string,
  ): Promise<Page<Contract>> {
    const api = await this.transactionApiManager.getApi(chainId);
    const contracts = await api.getTrustedForDelegateCallContracts();
    return ContractPageSchema.parse(contracts);
  }
}
