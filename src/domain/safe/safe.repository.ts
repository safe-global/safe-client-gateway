import { Inject, Injectable } from '@nestjs/common';
import { Safe } from './entities/safe.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ISafeRepository } from './safe.repository.interface';
import { SafeValidator } from './safe.validator';

@Injectable()
export class SafeRepository implements ISafeRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: SafeValidator,
  ) {}

  async getSafe(chainId: string, address: string): Promise<Safe> {
    const transactionService =
      await this.transactionApiManager.getTransactionApi(chainId);
    const safe: Safe = await transactionService.getSafe(address);
    return this.validator.validate(safe);
  }
}
