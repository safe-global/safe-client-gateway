import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/modules/collectibles/domain/collectibles.repository.interface';
import { Collectible } from '@/modules/collectibles/routes/entities/collectible.entity';
import { Page } from '@/routes/common/entities/page.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { Address } from 'viem';

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
