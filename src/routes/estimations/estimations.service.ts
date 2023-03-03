import { Inject, Injectable } from '@nestjs/common';
import { GetEstimationDto } from '../../domain/estimations/entities/get-estimation.dto.entity';
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
   * Returns an {@link Estimation}, and also the current and recommended next nonce to use.
   * The current nonce is the Safe nonce.
   * The next recommended nonce is the maximum between the current Safe nonce and the Safe
   * last transaction nonce plus 1. If there is no last transaction, the Safe nonce is returned.
   *
   * @param chainId chain id for the estimation.
   * @param address address of the Safe requesting the estimation.
   * @param getEstimationDto {@link GetEstimationDto} data.
   * @returns {@link EstimationResponse} containing {@link Estimation}, and both
   * current and recommended next nonce values
   */
  async getEstimation(
    chainId: string,
    address: string,
    getEstimationDto: GetEstimationDto,
  ): Promise<EstimationResponse> {
    const estimation = await this.estimationsRepository.getEstimation(
      chainId,
      address,
      getEstimationDto,
    );
    const safe = await this.safeRepository.getSafe(chainId, address);
    const recommendedNonce = await this.getEstimationRecommendedNonce(
      chainId,
      address,
      safe.nonce,
    );
    return new EstimationResponse(
      safe.nonce,
      recommendedNonce,
      estimation.safeTxGas,
    );
  }

  /**
   * Gets the maximum between the current Safe nonce and the last transaction nonce plus 1.
   * If there is no last transaction, the Safe nonce is returned.
   *
   * @param chainId chain id for the estimation.
   * @param safeAddress address of the Safe requesting the estimation.
   * @param safeNonce nonce of the Safe requesting the estimation.
   * @returns recommended nonce for next transaction.
   */
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
