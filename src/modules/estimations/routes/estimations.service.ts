import { Inject, Injectable } from '@nestjs/common';
import { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';
import { EstimationsRepository } from '@/modules/estimations/domain/estimations.repository';
import { IEstimationsRepository } from '@/modules/estimations/domain/estimations.repository.interface';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { EstimationResponse } from '@/modules/estimations/routes/entities/estimation-response.entity';
import type { Address } from 'viem';

@Injectable()
export class EstimationsService {
  constructor(
    @Inject(IEstimationsRepository)
    private readonly estimationsRepository: EstimationsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  /**
   * Returns an {@link Estimation}, and also the current and recommended next nonce to use.
   * The current nonce is the Safe nonce.
   * The next recommended nonce is the maximum between the current Safe nonce and the Safe
   * last transaction nonce plus 1. If there is no last transaction, the Safe nonce is returned.
   *
   * @returns {@link EstimationResponse} containing {@link Estimation}, and both
   * current and recommended next nonce values
   */
  async getEstimation(args: {
    chainId: string;
    address: Address;
    getEstimationDto: GetEstimationDto;
  }): Promise<EstimationResponse> {
    const estimation = await this.estimationsRepository.getEstimation(args);
    const nonceState = await this.safeRepository.getNonces({
      chainId: args.chainId,
      safeAddress: args.address,
    });
    return new EstimationResponse(
      nonceState.currentNonce,
      nonceState.recommendedNonce,
      estimation.safeTxGas,
    );
  }
}
