// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import type {
  CounterpartyAnalysisResponse,
  SingleRecipientAnalysisResponse,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';

@Injectable()
export class SpaceSafeShieldService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ISafeShieldAnalysis)
    private readonly safeShieldAnalysis: ISafeShieldAnalysis,
  ) {}

  /** Membership is `CopilotScansGuard`'s to check; only the Safe is ours. */
  public async analyzeRecipient(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    recipientAddress: Address;
  }): Promise<SingleRecipientAnalysisResponse> {
    await this.assertBelongsToSpace(args);

    return this.safeShieldAnalysis.analyzeRecipient(
      args.chainId,
      args.safeAddress,
      args.recipientAddress,
    );
  }

  public async analyzeCounterparty(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    tx: {
      to: Address;
      value: string;
      data: Hex;
      operation: Operation;
    };
  }): Promise<CounterpartyAnalysisResponse> {
    await this.assertBelongsToSpace(args);

    return this.safeShieldAnalysis.analyzeCounterparty({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      tx: args.tx,
    });
  }

  private async assertBelongsToSpace(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const belongs = await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safeAddress,
    });
    if (!belongs) {
      throw new ForbiddenException('Safe is not registered to this Workspace.');
    }
  }
}
