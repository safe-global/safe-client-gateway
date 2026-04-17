// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { FeePreviewTransactionDto } from '@/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { FeePreviewResponse } from '@/modules/fees/routes/entities/fee-preview-response.entity';
import type { Address } from 'viem';

@Injectable()
export class FeesService {
  constructor(
    @Inject(IFeeServiceApi)
    private readonly feeServiceApi: IFeeServiceApi,
  ) {}

  async getFeePreview(args: {
    chainId: string;
    safeAddress: Address;
    feePreviewDto: FeePreviewTransactionDto;
  }): Promise<FeePreviewResponse> {
    if (!this.feeServiceApi.isPayWithSafeEnabled(args.chainId)) {
      throw new BadRequestException(
        'Pay with Safe not available for this chain',
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
