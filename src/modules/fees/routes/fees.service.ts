// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { IGasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository.interface';
import { FeePreviewResponse } from '@/modules/fees/routes/entities/fee-preview-response.entity';
import type { FeePreviewTransactionDto } from '@/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { GasToken } from '@/modules/fees/routes/entities/gas-token.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import {
  cursorUrlFromLimitAndOffset,
  type PaginationData,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class FeesService {
  constructor(
    @Inject(IFeeServiceApi)
    private readonly feeServiceApi: IFeeServiceApi,
    @Inject(IGasTokensRepository)
    private readonly gasTokensRepository: IGasTokensRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getGasTokens(
    routeUrl: Readonly<URL>,
    chainId: string,
    paginationData: PaginationData,
  ): Promise<Page<GasToken>> {
    const result = await this.gasTokensRepository.getGasTokens({
      chainId,
      limit: paginationData.limit,
      offset: paginationData.offset,
    });

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, result.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, result.previous);

    return {
      count: result.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: result.results.map((gasToken) => new GasToken(gasToken)),
    };
  }

  async getFeePreview(args: {
    chainId: string;
    safeAddress: Address;
    feePreviewDto: FeePreviewTransactionDto;
  }): Promise<FeePreviewResponse> {
    const chain = await this.chainsRepository.getChain(args.chainId);

    switch (chain.relayer?.type) {
      case RelayerType.RELAY_FEE: {
        const txFeesResponse = await this.feeServiceApi.getRelayFees({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          request: args.feePreviewDto,
        });
        return FeePreviewResponse.fromRelayFees(txFeesResponse);
      }
      case RelayerType.GTF: {
        const gtfFeesResponse = await this.feeServiceApi.getGtfFees({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          request: args.feePreviewDto,
        });
        return FeePreviewResponse.fromGtfFees(gtfFeesResponse);
      }
      default:
        throw new BadRequestException(
          'Fee preview is not available for this chain',
        );
    }
  }
}
