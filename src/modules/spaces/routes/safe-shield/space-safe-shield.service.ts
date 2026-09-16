// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import type {
  CounterpartyAnalysisResponse,
  SingleRecipientAnalysisResponse,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SpaceSafeShieldService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
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
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);
    await this.spaceSafesRepository.assertBelongsToSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safeAddress,
    });

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
    authPayload: AuthPayload;
    tx: {
      to: Address;
      value: string;
      data: Hex;
      operation: Operation;
    };
  }): Promise<CounterpartyAnalysisResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);
    await this.spaceSafesRepository.assertBelongsToSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safeAddress,
    });

    return this.safeShieldAnalysis.analyzeCounterparty({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      tx: args.tx,
    });
  }
}
