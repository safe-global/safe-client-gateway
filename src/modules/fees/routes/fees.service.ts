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

/**
 * Config-service feature that marks Safenet checks as available on a chain.
 */
const SAFENET_CHECKS_FEATURE = 'SAFENET_CHECKS';

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
        // The user's per-transaction opt-in, honoured only where the viewed
        // chain offers Safenet checks — fail closed. Previews that disagree on
        // the flag are safe by construction: the fee service encodes the fee
        // into baseGas, so the two choices are different safeTxHashes and
        // distinct quotes; whichever the user signs is what is billed and
        // checked.
        const safenetCheck =
          args.feePreviewDto.safenetCheck === true &&
          chain.features.includes(SAFENET_CHECKS_FEATURE);
        const gtfFeesResponse = await this.feeServiceApi.getGtfFees({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          // Listed field by field, not spread: this endpoint's contract is
          // narrower than the route DTO, and the datasource parses the body
          // strictly, so an unrelated DTO field must not leak in here.
          request: {
            to: args.feePreviewDto.to,
            value: args.feePreviewDto.value,
            data: args.feePreviewDto.data,
            operation: args.feePreviewDto.operation,
            numberSignatures: args.feePreviewDto.numberSignatures,
            nonce: args.feePreviewDto.nonce,
            gasToken: args.feePreviewDto.gasToken,
            origin: args.feePreviewDto.origin,
            // Omitted when false. Two assumptions about the fee service, neither
            // verifiable from this repo: it rejects a request body carrying a
            // field its own DTO does not declare, and absent and false are the
            // same value to it. On both, a fee service that predates the flag
            // keeps working for every unchecked chain.
            ...(safenetCheck && { safenetCheck }),
          },
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
