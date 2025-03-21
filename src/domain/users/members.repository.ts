import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isAddressEqual } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { Member as DbMember } from '@/datasources/users/entities/member.entity.db';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';
import { In } from 'typeorm';
import type {
  FindOptionsWhere,
  FindOptionsRelations,
  FindManyOptions,
} from 'typeorm';
import type { IMembersRepository } from '@/domain/users/members.repository.interface';
import type { Space } from '@/domain/spaces/entities/space.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { Invitation } from '@/domain/users/entities/invitation.entity';
import { type Member } from '@/domain/users/entities/member.entity';

@Injectable()
export class MembersRepository implements IMembersRepository {
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async findOneOrFail(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember> {
    const space = await this.findOne(where, relations);

    if (!space) {
      throw new NotFoundException('Member not found.');
    }

    return space;
  }

  public async findOne(
    where: Array<FindOptionsWhere<Member>> | FindOptionsWhere<Member>,
    relations?: FindOptionsRelations<Member>,
  ): Promise<DbMember | null> {
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    return await membersRepository.findOne({
      where,
      relations,
    });
  }

  public async findOrFail(
    args?: FindManyOptions<DbMember>,
  ): Promise<[DbMember, ...Array<DbMember>]> {
    const members = await this.find(args);

    if (members.length === 0) {
      throw new NotFoundException('No members found.');
    }

    return members as [DbMember, ...Array<DbMember>];
  }

  public async find(
    args?: FindManyOptions<DbMember>,
  ): Promise<Array<DbMember>> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(DbMember);

    return await organizationRepository.find(args);
  }

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    users: Array<{
      name: Member['name'];
      address: `0x${string}`;
      role: Member['role'];
    }>;
  }): Promise<Array<Invitation>> {
    this.assertSignerAddress(args.authPayload);
    const { signer_address: adminAddress } = args.authPayload;

    const admin =
      await this.usersRepository.findByWalletAddressOrFail(adminAddress);
    const org = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
    });
    const userOrganizationsRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const activeAdmin = await userOrganizationsRepository.findOne({
      where: { user: { id: admin.id }, status: 'ACTIVE', role: 'ADMIN' },
    });
    if (!activeAdmin) {
      throw new UnauthorizedException('Signer is not an active admin.');
    }

    const invitedAddresses = args.users.map((user) => user.address);
    const invitedWallets = await this.walletsRepository.find({
      where: {
        address: In(invitedAddresses),
      },
      relations: {
        user: true,
      },
    });

    const invitations: Array<Invitation> = [];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      for (const userToInvite of args.users) {
        // Find existing User via Wallet
        const invitedWallet = invitedWallets.find((wallet) => {
          return isAddressEqual(wallet.address, userToInvite.address);
        });
        let invitedUserId = invitedWallet?.user.id;

        // Otherwise create User and Wallet
        if (!invitedUserId) {
          invitedUserId = await this.usersRepository.create(
            'PENDING',
            entityManager,
          );

          await this.walletsRepository.create(
            {
              walletAddress: userToInvite.address,
              userId: invitedUserId,
            },
            entityManager,
          );
        }

        await entityManager.insert(DbMember, {
          user: { id: invitedUserId },
          space: org,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy: adminAddress,
        });

        invitations.push({
          userId: invitedUserId,
          spaceId: org.id,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy: adminAddress,
        });
      }
    });

    return invitations;
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    payload: Pick<Member, 'name'>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const org = await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: { user: { id: user.id }, status: 'INVITED' },
      },
      relations: { members: { user: true } },
    });
    const member = org.members[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'ACTIVE',
        name: args.payload.name,
      });

      await this.usersRepository.updateStatus({
        userId: user.id,
        status: 'ACTIVE',
        entityManager,
      });
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const org = await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: { user: { id: user.id }, status: 'INVITED' },
      },
      relations: { members: { user: true } },
    });
    const member = org.members[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbMember, member.id, {
        status: 'DECLINED',
      });
    });
  }

  public async findAuthorizedMembersOrFail(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<Member>> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const member = await membersRepository.findOne({
      where: {
        user: { id: user.id },
        space: { id: args.spaceId },
        status: 'ACTIVE',
      },
    });
    if (!member) {
      throw new UnauthorizedException(
        'The user is not an active member of the space.',
      );
    }
    const org = await this.spacesRepository.findOneOrFail({
      where: { id: args.spaceId },
      relations: { members: { user: true } },
    });

    return org.members;
  }

  private findActiveAdminsOrFail(spaceId: Space['id']): Promise<Array<Member>> {
    return this.findOrFail({
      where: { space: { id: spaceId }, role: 'ADMIN', status: 'ACTIVE' },
      relations: { user: true },
    });
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    userId: User['id'];
    role: Member['role'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsActiveAdmin({ userOrgs: activeAdmins, userId: user.id });
    const isSelf = user.id === args.userId;
    if (isSelf && args.role !== 'ADMIN') {
      this.assertIsNotLastAdmin({ userOrgs: activeAdmins, userId: user.id });
    }

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const updateResult = await membersRepository.update(
      { user: { id: args.userId }, space: { id: args.spaceId } },
      { role: args.role },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('User space not found.');
    }
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    userId: User['id'];
    spaceId: Space['id'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const activeAdmins = await this.findActiveAdminsOrFail(args.spaceId);

    this.assertIsActiveAdmin({ userOrgs: activeAdmins, userId: user.id });
    const isSelf = user.id === args.userId;
    if (isSelf) {
      this.assertIsNotLastAdmin({ userOrgs: activeAdmins, userId: user.id });
    }

    const membersRepository =
      await this.postgresDatabaseService.getRepository(DbMember);
    const deleteResult = await membersRepository.delete({
      user: { id: args.userId },
      space: { id: args.spaceId },
    });

    if (deleteResult.affected === 0) {
      throw new NotFoundException('User space not found.');
    }
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided.');
    }
  }

  private assertIsActiveAdmin(args: {
    userOrgs: Array<DbMember>;
    userId: User['id'];
  }): void {
    if (
      !args.userOrgs.some((member) => {
        return this.isActiveAdmin(member) && member.user.id === args.userId;
      })
    ) {
      throw new UnauthorizedException('Signer is not an active admin.');
    }
  }

  private assertIsNotLastAdmin(args: {
    userOrgs: Array<DbMember>;
    userId: User['id'];
  }): void {
    if (
      args.userOrgs.length === 1 &&
      args.userOrgs[0].user.id === args.userId &&
      this.isActiveAdmin(args.userOrgs[0])
    ) {
      throw new ConflictException('Cannot remove last admin.');
    }
  }

  private isActiveAdmin(member: DbMember): boolean {
    return member.role === 'ADMIN' && member.status === 'ACTIVE';
  }
}
