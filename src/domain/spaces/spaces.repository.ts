import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { User } from '@/datasources/users/entities/users.entity.db';
import { getEnumKey } from '@/domain/common/utils/enum';
import { SpaceStatus } from '@/domain/spaces/entities/space.entity';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import {
  MemberRole,
  MemberStatus,
} from '@/domain/users/entities/member.entity';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  In,
  IsNull,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

// TODO: Add tests
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
  }): Promise<Pick<Space, 'id' | 'name'>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    const isLimited = await this.isLimited(args.userId);
    if (isLimited) {
      throw new ForbiddenException(
        'User has reached the maximum number of Spaces.',
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
      name: insertResult.name,
    };
  }

  public async findOneOrFail(
    args: Parameters<SpacesRepository['findOne']>[0],
  ): Promise<Space> {
    const space = await this.findOne(args);

    if (!space) {
      throw new NotFoundException('Space not found.');
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
      throw new NotFoundException('Spaces not found.');
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
      throw new NotFoundException('Spaces not found. UserId = ' + args.userId);
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
      throw new NotFoundException('Space not found. UserId = ' + args.userId);
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
  }): Promise<Pick<Space, 'id'>> {
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(Space);

    await spaceRepository.update(args.id, args.updatePayload);

    return { id: args.id };
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
