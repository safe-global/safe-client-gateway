// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { FeePreviewResponse } from '@/modules/fees/routes/entities/fee-preview-response.entity';
import type { FeePreviewTransactionDto } from '@/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

@Injectable()
export class FeesService {
  constructor(
    @Inject(IFeeServiceApi)
    private readonly feeServiceApi: IFeeServiceApi,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async getFeePreview(args: {
    chainId: string;
    safeAddress: Address;
    feePreviewDto: FeePreviewTransactionDto;
  }): Promise<FeePreviewResponse> {
    const chain = await this.chainsRepository.getChain(args.chainId);
    if (chain.relayer?.type !== RelayerType.RELAY_FEE) {
      throw new BadRequestException(
        `Accessing fee preview is only available for chains with ${RelayerType.RELAY_FEE} relayer`,
      );
    }

    const txFeesResponse = await this.feeServiceApi.getRelayFees({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      request: args.feePreviewDto,
    });

    return new FeePreviewResponse(txFeesResponse);
  }
}
