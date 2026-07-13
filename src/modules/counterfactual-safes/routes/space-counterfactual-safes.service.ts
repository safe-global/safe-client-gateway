// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { transformCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/counterfactual-safes.utils';
import type { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SpaceCounterfactualSafesService {
  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ICounterfactualSafesRepository)
    private readonly counterfactualSafesRepository: ICounterfactualSafesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  public async get(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<GetCounterfactualSafesResponse> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(spaceId);

    if (spaceSafes.length === 0) {
      return { safes: {} };
    }

    const whereClause = spaceSafes.map((safe) => ({
      chainId: safe.chainId,
      address: safe.address,
    }));

    const counterfactualSafes = await this.counterfactualSafesRepository.find({
      where: whereClause,
    });

    // Stale counterfactual_safes rows aren't cleared on deployment, so drop any
    // Safe that is actually deployed on-chain before returning.
    const undeployedSafes = await this.filterUndeployed(counterfactualSafes);

    return {
      safes: transformCounterfactualSafesResponse(undeployedSafes),
    };
  }

  private async filterUndeployed(
    safes: Array<CounterfactualSafe>,
  ): Promise<Array<CounterfactualSafe>> {
    const deploymentChecks = await Promise.all(
      safes.map(async (safe) => {
        try {
          return await this.safeRepository.isSafe({
            chainId: safe.chainId,
            address: safe.address,
          });
        } catch {
          return false;
        }
      }),
    );

    return safes.filter((_, index) => !deploymentChecks[index]);
  }
}
