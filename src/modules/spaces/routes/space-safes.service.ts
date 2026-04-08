// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { CreateSpaceSafeDto } from '@/modules/spaces/routes/entities/create-space-safe.dto.entity';
import type { DeleteSpaceSafeDto } from '@/modules/spaces/routes/entities/delete-space-safe.dto.entity';
import type { GetSpaceSafeResponse } from '@/modules/spaces/routes/entities/get-space-safe.dto.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/routes/utils/space-assert.utils';
import { Inject, Injectable } from '@nestjs/common';
import { groupBy, mapValues } from 'lodash';

@Injectable()
export class SpaceSafesService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  public async create(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<CreateSpaceSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.spacesRepository, args.spaceId, userId);

    return await this.spaceSafesRepository.create({
      spaceId: args.spaceId,
      payload: args.payload,
    });
  }

  public async get(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(spaceId);

    return {
      safes: this.transformSpaceSafesResponse(spaceSafes),
    };
  }

  public async delete(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<DeleteSpaceSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.spacesRepository, args.spaceId, userId);

    await this.spaceSafesRepository.delete({
      spaceId: args.spaceId,
      payload: args.payload,
    });
  }

  /**
   * Transforms the space Safes response.
   *
   * Transform from:
   *       [
   *          { chainId: 1, address: '0x123' }, { chainId: 1, address: '0x456' }, { chainId: 2, address: '0x789' }
   *      ],
   * To:
   *      { 1: ['0x123', '0x456'], 2: ['0x789'] }
   *
   * @param {Array<Pick<SpaceSafe, 'chainId' | 'address'>>} spaceSafes
   *
   * @returns {GetSpaceSafeResponse}
   */
  private transformSpaceSafesResponse(
    spaceSafes: Array<Pick<SpaceSafe, 'chainId' | 'address'>>,
  ): GetSpaceSafeResponse['safes'] {
    const grouped = groupBy(spaceSafes, 'chainId');

    return mapValues(grouped, (items) => items.map((item) => item.address));
  }
}
