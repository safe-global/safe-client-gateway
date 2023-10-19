import { Inject, Injectable } from '@nestjs/common';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { ContractsValidator } from '@/domain/contracts/contracts.validator';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: ContractsValidator,
  ) {}

  async getContract(args: {
    chainId: string;
    contractAddress: string;
  }): Promise<Contract> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const data = await api.getContract(args.contractAddress);
    return this.validator.validate(data);
  }
}
