import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { CollectibleSchema } from '@/domain/collectibles/entities/schemas/collectible.schema';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getCollectibles(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    const page = await api.getCollectibles(args);
    page?.results.map((result) => CollectibleSchema.parse(result));
    return page;
  }

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.balancesApiManager.getBalancesApi(args.chainId);
    await api.clearCollectibles(args);
  }
}
