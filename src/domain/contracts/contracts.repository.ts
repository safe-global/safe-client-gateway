import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { IContractsRepository } from './contracts.repository.interface';
import { ContractsValidator } from './contracts.validator';
import { Contract } from './entities/contract.entity';

@Injectable()
export class ContractsRepository implements IContractsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: ContractsValidator,
  ) {}

  async getContract(chainId: string, contractAddress: string): Promise<Contract> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const data = await api.getContract(contractAddress);
    return this.validator.validate(data);
  }
}
