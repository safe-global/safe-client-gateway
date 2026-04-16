// SPDX-License-Identifier: FSL-1.1-MIT
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { transformCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/counterfactual-safes.utils';
import { Inject, Injectable } from '@nestjs/common';

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
