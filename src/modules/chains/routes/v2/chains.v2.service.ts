import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { type Page } from '@/domain/entities/page.entity';
import { Chain } from '@/modules/chains/routes/entities/chain.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class ChainsV2Service {
  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getChains(
    serviceKey: string,
    routeUrl: Readonly<URL>,
    paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    const result = await this.chainsRepository.getChainsV2(
      serviceKey,
      paginationData.limit,
      paginationData.offset,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, result.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, result.previous);

    const chains = result.results.map((chain) => {
      return new Chain(chain);
    });

    return {
      count: result.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: chains,
    };
  }

  async getChain(serviceKey: string, chainId: string): Promise<Chain> {
    const result = await this.chainsRepository.getChainV2(serviceKey, chainId);
    return new Chain(result);
  }
}
