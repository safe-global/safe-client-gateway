import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository.interface';
import { CollectiblePageSchema } from '@/modules/collectibles/domain/entities/schemas/collectible.schema';
import { Collectible } from '@/modules/collectibles/domain/entities/collectible.entity';
import { Page } from '@/domain/entities/page.entity';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Address } from 'viem';

@Injectable()
export class CollectiblesRepository implements ICollectiblesRepository {
  constructor(
    @Inject(IBalancesApiManager)
    private readonly balancesApiManager: IBalancesApiManager,
  ) {}

  async getCollectibles(args: {
    chain: Chain;
    safeAddress: Address;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): Promise<Page<Collectible>> {
    const api = await this.balancesApiManager.getApi(
      args.chain.chainId,
      args.safeAddress,
    );
    const page = await api.getCollectibles(args);
    return CollectiblePageSchema.parse(page);
  }

  async clearCollectibles(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const api = await this.balancesApiManager.getApi(
      args.chainId,
      args.safeAddress,
    );
    await api.clearCollectibles(args);
  }
}
