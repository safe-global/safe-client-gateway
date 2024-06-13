import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { Collectible } from '@/routes/collectibles/entities/collectible.entity';
import { Page } from '@/routes/common/entities/page.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';

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
    safeAddress: `0x${string}`;
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<Page<Collectible>> {
    const { chainId } = args;
    const chain = await this.chainsRepository.getChain(chainId);
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
