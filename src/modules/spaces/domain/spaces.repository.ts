// SPDX-License-Identifier: FSL-1.1-MIT

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type FindOptionsRelations,
  type FindOptionsSelect,
  type FindOptionsWhere,
  In,
  IsNull,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { getEnumKey } from '@/domain/common/utils/enum';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  SpaceAuditEventType,
  type SpaceUpdatedPayload,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import {
  MemberRole,
  MemberStatus,
} from '@/modules/users/domain/entities/member.entity';

@Injectable()
export class SpacesRepository implements ISpacesRepository {
  private readonly maxSpaceCreationsPerUser: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
  ) {
    this.maxSpaceCreationsPerUser =
      this.configurationService.getOrThrow<number>(
        'spaces.maxSpaceCreationsPerUser',
      );
  }

  public async create(args: {
    userId: number;
    name: string;
    status: keyof typeof SpaceStatus;
  }): Promise<Pick<Space, 'uuid' | 'name'>> {
    const isLimited = await this.isLimited(args.userId);
    if (isLimited) {
      throw new ForbiddenException(
        'User has reached the maximum number of Workspaces.',
      );
    }

    const user = new User();
    user.id = args.userId;

    const space = new Space();
    space.status = args.status;
    space.name = args.name;

    // @todo Move to MembersRepository
    const member = new Member();
    member.name = `${space.name} creator`;
    member.role = getEnumKey(MemberRole, MemberRole.ADMIN);
    member.status = getEnumKey(MemberStatus, MemberStatus.ACTIVE);
    member.user = user;
    member.space = space;

    space.members = [member];

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        const insertResult = await entityManager.save(space);

        await this.spaceAuditRepository.record(entityManager, {
          spaceId: insertResult.id,
          spaceUuid: insertResult.uuid,
          eventType: SpaceAuditEventType.SPACE_CREATED,
          actorUserId: args.userId,
          payload: { name: insertResult.name },
        });

        return {
          uuid: insertResult.uuid,
          name: insertResult.name,
        };
      },
    );
  }

  public async findOneOrFail(
    args: Parameters<SpacesRepository['findOne']>[0],
  ): Promise<Space> {
    const space = await this.findOne(args);

    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }

    return space;
  }

  public async findOne(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    return await spaceRepository.findOne(args);
  }

  public async findOrFail(
    args: Parameters<SpacesRepository['find']>[0],
  ): Promise<Array<Space>> {
    const spaces = await this.find(args);

    if (spaces.length === 0) {
      throw new NotFoundException('Workspaces not found.');
    }

    return spaces;
  }

  public async find(args: {
    where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    return await spaceRepository.find(args);
  }

  public async findByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Array<Space>> {
    const spaces = await this.findByUserId(args);

    if (spaces.length === 0) {
      throw new NotFoundException(
        `Workspaces not found. UserId = ${args.userId}`,
      );
    }

    return spaces;
  }

  public async findByUserId(args: {
    userId: number;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Array<Space>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const memberRepository =
      await this.postgresDatabaseService.getRepository(Member);

    const members = await memberRepository.find({
      where: { user: { id: args.userId } },
      relations: ['space'],
    });
    const membersIds = members.map((member) => member.space.id);

    return await spaceRepository.find({
      select: args.select,
      where: {
        id: In(membersIds),
      },
      relations: args.relations,
    });
  }

  public async findOneByUserIdOrFail(
    args: Parameters<SpacesRepository['findByUserId']>[0],
  ): Promise<Space> {
    const space = await this.findOneByUserId(args);

    if (!space) {
      throw new NotFoundException(
        `Workspace not found. UserId = ${args.userId}`,
      );
    }

    return space;
  }

  public async findOneByUserId(args: {
    userId: number;
    select?: FindOptionsSelect<Space>;
    relations?: FindOptionsRelations<Space>;
  }): Promise<Space | null> {
    return await this.findOne({
      where: {
        members: { user: { id: args.userId } },
      },
      select: args.select,
      relations: args.relations,
    });
  }

  public async update(args: {
    id: Space['id'];
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>;
    actorUserId: number;
  }): Promise<Pick<Space, 'uuid'>> {
    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Old values are read inside the transaction to keep the diff exact.
        const current = await entityManager.findOne(Space, {
          where: { id: args.id },
          select: { id: true, uuid: true, name: true, status: true },
        });
        if (!current) {
          throw new NotFoundException('Workspace not found.');
        }

        await entityManager
          .createQueryBuilder()
          .update(Space)
          .set(args.updatePayload)
          .where({ id: args.id })
          .execute();

        const diff = this.diffSpaceUpdate(current, args.updatePayload);
        if (diff) {
          await this.spaceAuditRepository.record(entityManager, {
            spaceId: current.id,
            spaceUuid: current.uuid,
            eventType: SpaceAuditEventType.SPACE_UPDATED,
            actorUserId: args.actorUserId,
            payload: diff,
          });
        }

        return { uuid: current.uuid };
      },
    );
  }

  /** Changed `name`/`status` fields of a space update, or `null` for a no-op. */
  private diffSpaceUpdate(
    current: Pick<Space, 'name' | 'status'>,
    updatePayload: Partial<Pick<Space, 'name' | 'status'>>,
  ): SpaceUpdatedPayload | null {
    const { name, status } = updatePayload;
    const oldFields: SpaceUpdatedPayload['old'] = {};
    const newFields: SpaceUpdatedPayload['new'] = {};

    if (name !== undefined && name !== current.name) {
      oldFields.name = current.name;
      newFields.name = name;
    }
    if (status !== undefined && status !== current.status) {
      oldFields.status = current.status;
      newFields.status = status;
    }

    return Object.keys(newFields).length > 0
      ? { old: oldFields, new: newFields }
      : null;
  }

  public async findIdByUuid(uuid: Space['uuid']): Promise<Space['id']> {
    const space = await this.findOneOrFail({
      where: { uuid },
      select: { id: true },
    });
    return space.id;
  }

  // Resolves the internal numeric id to the client-facing UUID. Mappers hold a
  // numeric spaceId internally and use this to emit the UUID in responses.
  public async findUuidById(id: Space['id']): Promise<Space['uuid']> {
    const space = await this.findOneOrFail({
      where: { id },
      select: { uuid: true },
    });
    return space.uuid;
  }

  // @todo Add a soft delete method
  public async delete(args: {
    id: number;
    actorUserId: number;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const space = await entityManager.findOne(Space, {
        where: { id: args.id },
        select: { id: true, uuid: true, name: true },
      });
      if (!space) {
        throw new NotFoundException('Workspace not found.');
      }

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SPACE_DELETED,
        actorUserId: args.actorUserId,
        payload: { name: space.name },
      });

      await entityManager.delete(Space, space.id);
    });
  }

  /**
   * Determines if a user has reached the maximum number of spaces they can create.
   * If the user is member of a space that was not invited by anyone, they are considered to have created that space.
   */
  private async isLimited(userId: number): Promise<boolean> {
    const memberRepository =
      await this.postgresDatabaseService.getRepository(Member);
    const unInvitedMemberships = await memberRepository.find({
      where: { user: { id: userId }, invitedBy: IsNull() },
    });
    return unInvitedMemberships.length >= this.maxSpaceCreationsPerUser;
  }
}
