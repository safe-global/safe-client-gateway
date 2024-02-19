import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { CollectiblesValidator } from '@/domain/collectibles/collectibles.validator';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
    private readonly validator: CollectiblesValidator,
  ) {}

  async getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    const page = (await this.balancesApiManager.useExternalApi(args.chainId))
      ? await this._getCollectiblesFromBalancesApi(args)
      : await this._getCollectiblesFromTransactionApi(args);

    page?.results.map((result) => this.validator.validate(result));
    return page;
  }

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    await api.clearCollectibles(args);
  }

  private async _getCollectiblesFromBalancesApi(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Collectible>> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    return api.getCollectibles(args);
  }

  private async _getCollectiblesFromTransactionApi(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    return api.getCollectibles({
      safeAddress: args.safeAddress,
      limit: args.limit,
      offset: args.offset,
      trusted: args.trusted,
      excludeSpam: args.excludeSpam,
    });
  }
}
