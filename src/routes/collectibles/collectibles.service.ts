import { Inject, Injectable } from '@nestjs/common';
import { ICollectiblesRepository } from '../../domain/collectibles/collectibles.repository.interface';
import { Collectible } from './entities/collectible.entity';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';

@Injectable()
export class CollectiblesService {
  constructor(
    @Inject(ICollectiblesRepository)
    private readonly repository: ICollectiblesRepository,
  ) {}

  async getCollectibles(
    chainId: string,
    safeAddress: string,
    routeUrl: Readonly<URL>,
    paginationData: PaginationData,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>> {
    const collectibles = await this.repository.getCollectibles(
      chainId,
      safeAddress,
      paginationData.limit,
      paginationData.offset,
      trusted,
      excludeSpam,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, collectibles.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      collectibles.previous,
    );

    return <Page<Collectible>>{
      count: collectibles.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: collectibles.results,
    };
  }
}
