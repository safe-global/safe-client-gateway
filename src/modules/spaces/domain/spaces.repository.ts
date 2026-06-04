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
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { getEnumKey } from '@/domain/common/utils/enum';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
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
  }): Promise<Pick<Space, 'id' | 'uuid' | 'name'>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

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

    const insertResult = await spaceRepository.save(space);

    return {
      id: insertResult.id,
      uuid: insertResult.uuid,
      name: insertResult.name,
    };
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
    updatePayload: QueryDeepPartialEntity<Space>;
  }): Promise<Pick<Space, 'id' | 'uuid'>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const result = await spaceRepository
      .createQueryBuilder()
      .update(Space)
      .set(args.updatePayload)
      .where({ id: args.id })
      .returning(['id', 'uuid'])
      .execute();

    const row = result.generatedMaps[0] as
      | Pick<Space, 'id' | 'uuid'>
      | undefined;
    if (!row) {
      throw new NotFoundException('Space not found.');
    }

    return { id: row.id, uuid: row.uuid };
  }

  public async findIdByUuid(uuid: Space['uuid']): Promise<Space['id']> {
    const space = await this.findOneOrFail({
      where: { uuid },
      select: { id: true },
    });
    return space.id;
  }

  // TODO: remove after FE removes numeric Space ID fallback.
  // Input format is validated upstream by LegacySpaceIdPipe; this method only
  // branches on numeric-vs-UUID and performs the lookup.
  public async findIdByIdOrUuid(value: string): Promise<Space['id']> {
    if (/^\d+$/.test(value)) {
      const space = await this.findOneOrFail({
        where: { id: Number(value) },
        select: { id: true },
      });
      return space.id;
    }
    return await this.findIdByUuid(value as Space['uuid']);
  }

  // @todo Add a soft delete method
  public async delete(id: number): Promise<void> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const space = await this.findOneOrFail({
      where: { id },
    });

    await spaceRepository.delete(space.id);
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
