import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isAddressEqual } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserOrganization as DbUserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';
import { In } from 'typeorm';
import type {
  FindOptionsWhere,
  FindOptionsRelations,
  FindManyOptions,
} from 'typeorm';
import type { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { Invitation } from '@/domain/users/entities/invitation.entity';
import { type UserOrganization } from '@/domain/users/entities/user-organization.entity';

@Injectable()
export class UsersOrganizationsRepository
  implements IUsersOrganizationsRepository
{
  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IOrganizationsRepository)
    private readonly organizationsRepository: IOrganizationsRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async findOneOrFail(
    where:
      | Array<FindOptionsWhere<UserOrganization>>
      | FindOptionsWhere<UserOrganization>,
    relations?: FindOptionsRelations<UserOrganization>,
  ): Promise<DbUserOrganization> {
    const organization = await this.findOne(where, relations);

    if (!organization) {
      throw new NotFoundException('User organization not found.');
    }

    return organization;
  }

  public async findOne(
    where:
      | Array<FindOptionsWhere<UserOrganization>>
      | FindOptionsWhere<UserOrganization>,
    relations?: FindOptionsRelations<UserOrganization>,
  ): Promise<DbUserOrganization | null> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    return await organizationRepository.findOne({
      where,
      relations,
    });
  }

  public async findOrFail(
    args?: FindManyOptions<DbUserOrganization>,
  ): Promise<[DbUserOrganization, ...Array<DbUserOrganization>]> {
    const userOrgs = await this.find(args);

    if (userOrgs.length === 0) {
      throw new NotFoundException('No user organizations found.');
    }

    return userOrgs as [DbUserOrganization, ...Array<DbUserOrganization>];
  }

  public async find(
    args?: FindManyOptions<DbUserOrganization>,
  ): Promise<Array<DbUserOrganization>> {
    const organizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    return await organizationRepository.find(args);
  }

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    users: Array<{
      name: UserOrganization['name'];
      address: `0x${string}`;
      role: UserOrganization['role'];
    }>;
  }): Promise<Array<Invitation>> {
    this.assertSignerAddress(args.authPayload);
    const { signer_address: adminAddress } = args.authPayload;

    const admin =
      await this.usersRepository.findByWalletAddressOrFail(adminAddress);
    const org = await this.organizationsRepository.findOneOrFail({
      where: {
        id: args.orgId,
        userOrganizations: {
          user: { id: admin.id },
          status: 'ACTIVE',
          role: 'ADMIN',
        },
      },
      relations: { userOrganizations: { user: true } },
    });

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

        await entityManager.insert(DbUserOrganization, {
          user: { id: invitedUserId },
          organization: org,
          name: userToInvite.name,
          role: userToInvite.role,
          status: 'INVITED',
          invitedBy: adminAddress,
        });

        invitations.push({
          userId: invitedUserId,
          orgId: org.id,
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
    orgId: Organization['id'];
    payload: Pick<UserOrganization, 'name'>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const org = await this.organizationsRepository.findOneOrFail({
      where: {
        id: args.orgId,
        userOrganizations: { user: { id: user.id }, status: 'INVITED' },
      },
      relations: { userOrganizations: { user: true } },
    });
    const userOrg = org.userOrganizations[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbUserOrganization, userOrg.id, {
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
    orgId: Organization['id'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const org = await this.organizationsRepository.findOneOrFail({
      where: {
        id: args.orgId,
        userOrganizations: { user: { id: user.id }, status: 'INVITED' },
      },
      relations: { userOrganizations: { user: true } },
    });
    const userOrg = org.userOrganizations[0];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbUserOrganization, userOrg.id, {
        status: 'DECLINED',
      });
    });
  }

  public async findAuthorizedUserOrgsOrFail(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    try {
      await this.findOneOrFail({
        user: { id: user.id },
        organization: { id: args.orgId },
      });
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new UnauthorizedException(
          'The user is not a member of the organization.',
        );
      }
      throw err;
    }
    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { userOrganizations: { user: true } },
    });

    return org.userOrganizations;
  }

  private findActiveAdminsOrFail(
    orgId: Organization['id'],
  ): Promise<Array<UserOrganization>> {
    return this.findOrFail({
      where: { organization: { id: orgId }, role: 'ADMIN', status: 'ACTIVE' },
      relations: { user: true },
    });
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    role: UserOrganization['role'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const activeAdmins = await this.findActiveAdminsOrFail(args.orgId);

    this.assertIsActiveAdmin({ userOrgs: activeAdmins, userId: user.id });
    const isSelf = user.id === args.userId;
    if (isSelf && args.role !== 'ADMIN') {
      this.assertIsNotLastAdmin({ userOrgs: activeAdmins, userId: user.id });
    }

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);
    const updateResult = await userOrganizationRepository.update(
      { user: { id: args.userId } },
      { role: args.role },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('User organization not found.');
    }
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    userId: User['id'];
    orgId: Organization['id'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const activeAdmins = await this.findActiveAdminsOrFail(args.orgId);

    this.assertIsActiveAdmin({ userOrgs: activeAdmins, userId: user.id });
    const isSelf = user.id === args.userId;
    if (isSelf) {
      this.assertIsNotLastAdmin({ userOrgs: activeAdmins, userId: user.id });
    }

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);
    const deleteResult = await userOrganizationRepository.delete({
      user: { id: args.userId },
    });

    if (deleteResult.affected === 0) {
      throw new NotFoundException('User organization not found.');
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
    userOrgs: Array<DbUserOrganization>;
    userId: User['id'];
  }): void {
    if (
      !args.userOrgs.some((userOrg) => {
        return this.isActiveAdmin(userOrg) && userOrg.user.id === args.userId;
      })
    ) {
      throw new UnauthorizedException('Signer is not an active admin.');
    }
  }

  private assertIsNotLastAdmin(args: {
    userOrgs: Array<DbUserOrganization>;
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

  private isActiveAdmin(userOrg: DbUserOrganization): boolean {
    return userOrg.role === 'ADMIN' && userOrg.status === 'ACTIVE';
  }
}
