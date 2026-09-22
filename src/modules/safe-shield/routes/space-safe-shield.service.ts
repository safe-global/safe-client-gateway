// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import type {
  CounterpartyAnalysisResponse,
  SingleRecipientAnalysisResponse,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SpaceSafeShieldService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IEntitlementEnforcement)
    private readonly entitlementEnforcement: IEntitlementEnforcement,
    @Inject(ISafeShieldAnalysis)
    private readonly safeShieldAnalysis: ISafeShieldAnalysis,
  ) {}

  public async analyzeRecipient(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    recipientAddress: Address;
    authPayload: AuthPayload;
  }): Promise<SingleRecipientAnalysisResponse> {
    await this.assertGated(args);

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
    authPayload: AuthPayload;
  }): Promise<CounterpartyAnalysisResponse> {
    await this.assertGated(args);

    return this.safeShieldAnalysis.analyzeCounterparty({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      tx: args.tx,
    });
  }

  /**
   * Checks membership, the copilot_scans entitlement, and that the Safe
   * belongs to the Space, in that order — each gate runs only once the one
   * before it passed, so a caller failing an earlier gate never reaches
   * information gated by a later one.
   */
  private async assertGated(args: {
    spaceId: Space['id'];
    chainId: string;
    safeAddress: Address;
    authPayload: AuthPayload;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    await this.entitlementEnforcement.assertFeatureGranted({
      spaceId: args.spaceId,
      featureKey: 'copilot_scans',
    });

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
