import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { CollectiblePageSchema } from '@/domain/collectibles/entities/schemas/collectible.schema';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getCollectibles(args: {
    chain: Chain;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    const api = await this.balancesApiManager.getBalancesApi(
      args.chain.chainId,
      args.safeAddress,
    );
    const page = await api.getCollectibles(args);
    return CollectiblePageSchema.parse(page);
  }

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    const api = await this.balancesApiManager.getBalancesApi(
      args.chainId,
      args.safeAddress,
    );
    await api.clearCollectibles(args);
  }
}
