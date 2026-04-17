import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { ICollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository.interface';
import type { Collectible } from '@/modules/collectibles/routes/entities/collectible.entity';
import type { Page } from '@/routes/common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  type PaginationData,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class CollectiblesService {
  constructor(
    @Inject(ICollectiblesRepository)
    private readonly repository: ICollectiblesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getCollectibles(args: {
    chainId: string;
    safeAddress: Address;
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Page<Collectible>> {
    const chain = await this.chainsRepository.getChain(args.chainId);
    const collectibles = await this.repository.getCollectibles({
      ...args,
      chain,
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

    const nextURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      collectibles.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      collectibles.previous,
    );

    return {
      count: collectibles.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: collectibles.results,
    };
  }
}
