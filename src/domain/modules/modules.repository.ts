import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IModulesRepository } from '@/domain/modules/modules.repository.interface';
import { SafesByModule } from '@/domain/modules/entities/safes-by-module.entity';

@Injectable()
export class ModulesRepository implements IModulesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<SafesByModule> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    return await api.getSafesByModule(args.moduleAddress);
  }

  async clearSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    await api.clearSafesByModule(args.moduleAddress);
  }
}
