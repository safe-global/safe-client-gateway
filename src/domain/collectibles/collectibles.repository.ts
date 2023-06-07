import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Collectible } from './entities/collectible.entity';
import { Page } from '../entities/page.entity';
import { ICollectiblesRepository } from './collectibles.repository.interface';
import { CollectiblesValidator } from './collectibles.validator';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: CollectiblesValidator,
  ) {}

  async getCollectibles(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>> {
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );
    const page = await transactionApi.getCollectibles(
      safeAddress,
      limit,
      offset,
      trusted,
      excludeSpam,
    );

    page?.results.map((result) => this.validator.validate(result));
    return page;
  }

  async clearCollectibles(chainId: string, safeAddress: string): Promise<void> {
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );

    return transactionApi.clearCollectibles(safeAddress);
  }
}
