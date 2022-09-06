import { Inject, Injectable } from '@nestjs/common';
import { Backbone, Chain, Page } from './entities';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { IDomainRepository } from '../domain/domain.repository.interface';

@Injectable()
export class ChainsService {
  constructor(
    @Inject(IDomainRepository) private readonly repository: IDomainRepository,
  ) {}

  async getChains(
    routeUrl: Readonly<URL>,
    paginationData?: PaginationData,
  ): Promise<Page<Chain>> {
    const result = await this.repository.getChains(
      paginationData?.limit,
      paginationData?.offset,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, result.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, result.previous);

    return {
      count: result.count,
      next: nextURL?.toString(),
      previous: previousURL?.toString(),
      results: result.results.map(
        (chain) =>
          <Chain>{
            chainId: chain.chainId,
            chainName: chain.chainName,
            vpcTransactionService: chain.vpcTransactionService,
          },
      ),
    };
  }

  async getBackbone(chainId: string): Promise<Backbone> {
    return this.repository.getBackbone(chainId);
  }
}
