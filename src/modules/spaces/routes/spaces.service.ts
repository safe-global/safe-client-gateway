// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { CreateSpaceResponse } from '@/modules/spaces/routes/entities/create-space.dto.entity';
import type { GetSpaceResponse } from '@/modules/spaces/routes/entities/get-space.dto.entity';
import type {
  UpdateSpaceDto,
  UpdateSpaceResponse,
} from '@/modules/spaces/routes/entities/update-space.dto.entity';
import { assertAdmin } from '@/modules/spaces/routes/utils/space-assert.utils';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { activeOrPendingMemberWhere } from '@/modules/users/domain/utils/members.utils';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

export class SpacesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async create(args: {
    name: Space['name'];
    status: Space['status'];
    authPayload: AuthPayload;
  }): Promise<CreateSpaceResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await this.usersRepository.findOneOrFail({ id: userId });
    await this.usersRepository.activateIfPending(userId);

    const result = await this.spacesRepository.create({ userId, ...args });
    return { id: result.uuid, name: result.name };
  }

  public getActiveOrInvitedSpaces(
    authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    return this.findSpaces(authPayload);
  }

  public async getActiveOrInvitedSpace(
    id: number,
    authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    const [space] = await this.findSpaces(authPayload, id);
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  private async findSpaces(
    authPayload: AuthPayload,
    spaceId?: number,
  ): Promise<Array<GetSpaceResponse>> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);

    const spaceScope = spaceId != null ? { space: { id: spaceId } } : {};
    const members = await this.membersRepository.find({
      where: activeOrPendingMemberWhere<Member>(() => ({
        user: { id: userId },
        ...spaceScope,
      })),
      relations: ['space'],
    });
    if (members.length === 0) {
      return [];
    }
    const spaces = await this.spacesRepository.find({
      where: { id: In(members.map((member) => member.space.id)) },
      select: {
        id: true,
        uuid: true,
        name: true,
        members: {
          role: true,
          name: true,
          invitedBy: true,
          inviteExpiresAt: true,
          status: true,
          user: { id: true },
        },
        safes: { id: true },
      },
      relations: { members: { user: true }, safes: true },
    });

    const invitedByNames = await this.resolveInvitedByNames(spaces);

    return spaces.map((space) => {
      const memberUserIds = new Set(
        space.members.map((member) => member.user.id),
      );

      return {
        id: space.uuid,
        name: space.name,
        members: space.members.map((member) => ({
          ...member,
          ...(member.status === 'INVITED' &&
            member.invitedBy != null &&
            memberUserIds.has(member.invitedBy) &&
            invitedByNames.has(member.invitedBy) && {
              invitedByName: invitedByNames.get(member.invitedBy),
            }),
        })),
        safeCount: space.safes?.length ?? 0,
      };
    });
  }

  public async getNumericId(uuid: string): Promise<Space['id']> {
    const space = await this.spacesRepository.findOneOrFail({
      where: { uuid },
      select: { id: true },
    });
    return space.id;
  }

  public async update(args: {
    id: Space['id'];
    updatePayload: UpdateSpaceDto;
    authPayload: AuthPayload;
  }): Promise<UpdateSpaceResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.spacesRepository, args.id, userId);

    const result = await this.spacesRepository.update(args);
    const space = await this.spacesRepository.findOneOrFail({
      where: { id: result.id },
      select: { uuid: true },
    });
    return { id: space.uuid };
  }

  /**
   * Resolves display names for valid inviters only:
   * - invited member has invitedBy set
   * - inviter is still a member of the same space
   *
   * Wallet address is preferred over email.
   *
   * Note: the returned map is keyed by user ID across all spaces. Callers must
   * re-check per-space membership before applying a name, since the same user
   * may be a valid inviter in one space and not a member of another.
   */
  private async resolveInvitedByNames(
    spaces: Array<Space>,
  ): Promise<Map<number, string>> {
    const userIds = Array.from(
      new Set(
        spaces.flatMap((space) => {
          const memberUserIds = new Set(
            space.members.map((member) => member.user.id),
          );

          return space.members.flatMap((member): Array<number> => {
            return member.status === 'INVITED' &&
              member.invitedBy != null &&
              memberUserIds.has(member.invitedBy)
              ? [member.invitedBy]
              : [];
          });
        }),
      ),
    );

    if (!userIds.length) {
      return new Map();
    }
    const result = new Map<number, string>();

    // Batch 1: resolve via wallets (preferred)
    const wallets = await this.walletsRepository.find({
      where: { user: { id: In(userIds) } },
      select: { address: true, user: { id: true } },
      relations: { user: true },
    });
    for (const wallet of wallets) {
      if (!result.has(wallet.user.id)) {
        result.set(wallet.user.id, wallet.address);
      }
    }

    // Batch 2: resolve remaining via email (OIDC-only users)
    const unresolvedIds = userIds.filter((id) => !result.has(id));
    const emails = await this.usersRepository.findEmailsByIds(unresolvedIds);
    return new Map([...result, ...(emails ?? [])]);
  }

  public async delete(args: {
    id: Space['id'];
    authPayload: AuthPayload;
  }): ReturnType<ISpacesRepository['delete']> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.spacesRepository, args.id, userId);

    return await this.spacesRepository.delete(args.id);
  }
}
