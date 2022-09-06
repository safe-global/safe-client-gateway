import { Injectable } from '@nestjs/common';
import { Page } from '../common/entities/page.entity';
import { ConfigApi } from '../datasources/config-api/config-api.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { Chain } from '../datasources/config-api/entities/chain.entity';
import { Backbone } from '../datasources/transaction-api/entities/backbone.entity';

@Injectable()
export class ChainsService {
  constructor(
    private readonly configApi: ConfigApi,
    private readonly transactionApiManager: TransactionApiManager,
  ) {}

  async getChains(
    routeUrl: Readonly<URL>,
    paginationData?: PaginationData,
  ): Promise<Page<Chain>> {
    const result = await this.configApi.getChains(
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
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );
    return transactionApi.getBackbone();
  }
}
