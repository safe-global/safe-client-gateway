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
  EntityManager,
} from 'typeorm';
import type { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { Invitation } from '@/domain/users/entities/invitation.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class UsersOrganizationsRepository
  implements IUsersOrganizationsRepository
{
  private readonly maxInvites: number;

  constructor(
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IOrganizationsRepository)
    private readonly organizationsRepository: IOrganizationsRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxInvites =
      this.configurationService.getOrThrow<number>('users.maxInvites');
  }

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

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    users: Array<{
      address: `0x${string}`;
      role: UserOrganization['role'];
    }>;
  }): Promise<Array<Invitation>> {
    if (args.users.length > this.maxInvites) {
      throw new ConflictException('Too many invites.');
    }

    const signer = await this.findSignerAndOrgOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);

    const invitedAddresses = args.users.map((user) => user.address);
    const invitedUsers = await this.walletsRepository.find({
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
        const invitedUser = invitedUsers.find(({ user }) => {
          return user.wallets.some((wallet) => {
            return isAddressEqual(wallet.address, userToInvite.address);
          });
        });
        let invitedUserId = invitedUser?.user.id;

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
          organization: signer.org,
          role: userToInvite.role,
          status: 'INVITED',
        });

        invitations.push({
          userId: invitedUserId,
          orgId: signer.org.id,
          role: userToInvite.role,
          status: 'INVITED',
        });
      }
    });

    return invitations;
  }

  public async acceptInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void> {
    const signer = await this.findSignerAndOrgOrFail(args);

    this.assertUserOrgIsInvited(signer.userOrg);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await this.updateStatus({
        userOrgId: signer.userOrg.id,
        status: 'ACTIVE',
        entityManager,
      });

      await this.usersRepository.updateStatus({
        userId: signer.user.id,
        status: 'ACTIVE',
        entityManager,
      });
    });
  }

  public async declineInvite(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<void> {
    const signer = await this.findSignerAndOrgOrFail(args);

    this.assertUserOrgIsInvited(signer.userOrg);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await this.updateStatus({
        userOrgId: signer.userOrg.id,
        status: 'DECLINED',
        entityManager,
      });
    });
  }

  private async updateStatus(args: {
    userOrgId: UserOrganization['id'];
    status: UserOrganization['status'];
    entityManager: EntityManager;
  }): Promise<void> {
    await args.entityManager.update(DbUserOrganization, args.userOrgId, {
      status: args.status,
    });
  }

  public async findAuthorizedUserOrgs(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>> {
    const signer = await this.findSignerAndOrgOrFail(args);
    return signer.org.userOrganizations;
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    role: UserOrganization['role'];
  }): Promise<void> {
    const signer = await this.findSignerAndOrgOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);
    this.assertUserOrgAdmin(signer.userOrg);
    if (args.role !== 'ADMIN') {
      this.assertNotLastActiveAdmin(signer.org.userOrganizations, args.userId);
    }

    const updateUserOrg = this.extractUserOrg({
      userOrgs: signer.org.userOrganizations,
      userId: args.userId,
    });

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);
    await userOrganizationRepository.update(
      { id: updateUserOrg.id },
      { role: args.role },
    );
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    userId: User['id'];
    orgId: Organization['id'];
  }): Promise<void> {
    const signer = await this.findSignerAndOrgOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);
    this.assertUserOrgAdmin(signer.userOrg);
    this.assertNotLastActiveAdmin(signer.org.userOrganizations, args.userId);

    const updateUserOrg = this.extractUserOrg({
      userOrgs: signer.org.userOrganizations,
      userId: args.userId,
    });

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);
    await userOrganizationRepository.delete(updateUserOrg.id);
  }

  // The following helper is used across every above method but they don't
  // necessarily require all orgs, e.g. some only invited, others active
  // TODO: Revisit implementation, maybe splitting into method-specific ones
  // that use WHERE clauses instead of assertions
  private async findSignerAndOrgOrFail(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<{
    org: Organization;
    user: User;
    userOrg: UserOrganization;
  }> {
    this.assertSignerAddress(args.authPayload);

    const user = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );
    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { userOrganizations: { user: true } },
    });
    const userOrg = this.extractUserOrg({
      userOrgs: org.userOrganizations,
      userId: user.id,
    });

    return { org, user, userOrg };
  }

  private extractUserOrg(args: {
    userOrgs: Array<UserOrganization>;
    userId: User['id'];
  }): UserOrganization {
    const userOrg = args.userOrgs.find((userOrg) => {
      return userOrg.user.id === args.userId;
    });
    if (!userOrg) {
      throw new NotFoundException('User organization not found.');
    }
    return userOrg;
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided.');
    }
  }

  private assertUserOrgIsInvited(
    userOrg: UserOrganization,
  ): asserts userOrg is UserOrganization & {
    status: 'INVITED';
  } {
    if (userOrg.status !== 'INVITED') {
      throw new ConflictException('User organization is not invited.');
    }
  }

  private assertUserOrgIsActive(
    userOrg: UserOrganization,
  ): asserts userOrg is UserOrganization & {
    status: 'ACTIVE';
  } {
    if (userOrg.status !== 'ACTIVE') {
      throw new UnauthorizedException('User organization is not active.');
    }
  }

  private assertUserOrgAdmin(
    userOrg: UserOrganization,
  ): asserts userOrg is UserOrganization & {
    role: UserOrganizationRole.ADMIN;
  } {
    if (userOrg.role !== 'ADMIN') {
      throw new UnauthorizedException('User organization is not an admin.');
    }
  }

  private assertNotLastActiveAdmin(
    userOrgs: Array<UserOrganization>,
    userId: User['id'],
  ): void {
    const activeAdmins = userOrgs.filter(
      (userOrg) => userOrg.status === 'ACTIVE' && userOrg.role === 'ADMIN',
    );

    if (activeAdmins.length === 1 && activeAdmins[0].user.id === userId) {
      throw new ConflictException('Cannot remove last admin.');
    }
  }
}
