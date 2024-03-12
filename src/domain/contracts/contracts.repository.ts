import { Inject, Injectable } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { ContractSchema } from '@/domain/contracts/entities/schemas/contract.schema';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getContract(args: {
    chainId: string;
    contractAddress: string;
  }): Promise<Contract> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const data = await api.getContract(args.contractAddress);
    return ContractSchema.parse(data);
  }
}
