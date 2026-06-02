// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { transformCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/counterfactual-safes.utils';
import type { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

@Injectable()
export class SpaceCounterfactualSafesService {
  public constructor(
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ICounterfactualSafesRepository)
    private readonly counterfactualSafesRepository: ICounterfactualSafesRepository,
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

    return {
      safes: transformCounterfactualSafesResponse(counterfactualSafes),
    };
  }
}
