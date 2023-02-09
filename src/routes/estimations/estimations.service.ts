import { Inject, Injectable } from '@nestjs/common';
import { EstimationRequest } from '../../domain/estimations/entities/estimation-request.entity';
import { EstimationsRepository } from '../../domain/estimations/estimations.repository';
import { IEstimationsRepository } from '../../domain/estimations/estimations.repository.interface';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { EstimationResponse } from './entities/estimation-response.entity';

@Injectable()
export class EstimationsService {
  constructor(
    @Inject(IEstimationsRepository)
    private readonly estimationsRepository: EstimationsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  /**
   * Returns and {@link Estimation} and also the current and recommended next nonce to use.
   * The current nonce is the Safe nonce.
   * The next recommended nonce is the maximum between the current Safe nonce and the Safe
   * last transaction nonce plus 1. If there is no last transaction, the Safe nonce is returned.
   *
   * @param chainId
   * @param address
   * @param estimationRequest
   * @returns {@link EstimationResponse} containing {@link Estimation}, and both
   * current and recommended next nonce values
   */
  async createEstimation(
    chainId: string,
    address: string,
    estimationRequest: EstimationRequest,
  ): Promise<EstimationResponse> {
    const estimation = await this.estimationsRepository.createEstimation(
      chainId,
      address,
      estimationRequest,
    );
    const currentNonce = await this.getSafeNonce(chainId, address);
    const recommendedNonce = await this.getEstimationRecommendedNonce(
      chainId,
      address,
      currentNonce,
    );
    return new EstimationResponse(estimation, currentNonce, recommendedNonce);
  }

  private async getSafeNonce(
    chainId: string,
    address: string,
  ): Promise<number> {
    const safe = await this.safeRepository.getSafe(chainId, address);
    return safe.nonce;
  }

  private async getEstimationRecommendedNonce(
    chainId: string,
    safeAddress: string,
    safeNonce: number,
  ): Promise<number> {
    const lastTransaction =
      await this.safeRepository.getLastTransactionSortedByNonce(
        chainId,
        safeAddress,
      );

    return lastTransaction
      ? Math.max(safeNonce, lastTransaction.nonce + 1)
      : safeNonce;
  }
}
