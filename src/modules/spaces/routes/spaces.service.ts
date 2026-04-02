// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserId } from '@/modules/auth/utils/assert-authenticated.utils';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { CreateSpaceResponse } from '@/modules/spaces/routes/entities/create-space.dto.entity';
import type { GetSpaceResponse } from '@/modules/spaces/routes/entities/get-space.dto.entity';
import type {
  UpdateSpaceDto,
  UpdateSpaceResponse,
} from '@/modules/spaces/routes/entities/update-space.dto.entity';
import { assertAdmin } from '@/modules/spaces/routes/utils/space-assert.utils';
import { Inject, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';

export class SpacesService {
  public constructor(
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
  ) {}

  public async create(args: {
    name: Space['name'];
    status: Space['status'];
    authPayload: AuthPayload;
  }): Promise<CreateSpaceResponse> {
    const userId = getAuthenticatedUserId(args.authPayload);
    await this.usersRepository.activateIfPending(userId);

    return await this.spacesRepository.create({ userId, ...args });
  }

  public async getActiveOrInvitedSpaces(
    authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    const userId = getAuthenticatedUserId(authPayload);

    const members = await this.membersRepository.find({
      where: { user: { id: userId }, status: In(['ACTIVE', 'INVITED']) },
      relations: ['space'],
    });
    if (members.length === 0) {
      return [];
    }
    const spaces = await this.spacesRepository.find({
      where: { id: In(members.map((member) => member.space.id)) },
      select: {
        id: true,
        name: true,
        members: {
          role: true,
          name: true,
          invitedBy: true,
          status: true,
          user: { id: true },
        },
        safes: { id: true },
      },
      relations: { members: { user: true }, safes: true },
    });

    return spaces.map((space) => ({
      id: space.id,
      name: space.name,
      members: space.members,
      safeCount: space.safes?.length ?? 0,
    }));
  }

  public async getActiveOrInvitedSpace(
    id: number,
    authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    const spaces = await this.getActiveOrInvitedSpaces(authPayload);
    const space = spaces.find((space) => space.id === id);
    if (!space) {
      throw new NotFoundException('Space not found.');
    }
    return space;
  }

  public async update(args: {
    id: Space['id'];
    updatePayload: UpdateSpaceDto;
    authPayload: AuthPayload;
  }): Promise<UpdateSpaceResponse> {
    const userId = getAuthenticatedUserId(args.authPayload);
    await assertAdmin(this.spacesRepository, args.id, userId);

    return await this.spacesRepository.update(args);
  }

  public async delete(args: {
    id: Space['id'];
    authPayload: AuthPayload;
  }): ReturnType<ISpacesRepository['delete']> {
    const userId = getAuthenticatedUserId(args.authPayload);
    await assertAdmin(this.spacesRepository, args.id, userId);

    return await this.spacesRepository.delete(args.id);
  }
}
