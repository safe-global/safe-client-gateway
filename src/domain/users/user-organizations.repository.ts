import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserOrganization as DbUserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';
import { User as DbUser } from '@/datasources/users/entities/users.entity.db';
import type { FindOptionsWhere, FindOptionsRelations } from 'typeorm';
import type { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

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

  public async inviteUsers(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    users: Array<{
      address: `0x${string}`;
      role: keyof typeof UserOrganizationRole;
    }>;
  }): Promise<
    Array<{
      userId: User['id'];
      orgId: Organization['id'];
      role: keyof typeof UserOrganizationRole;
      status: keyof typeof UserOrganizationStatus;
    }>
  > {
    const signer = await this.getOrgAndSignerOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);

    const invitations: Array<{
      userId: User['id'];
      orgId: Organization['id'];
      role: keyof typeof UserOrganizationRole;
      status: keyof typeof UserOrganizationStatus;
    }> = [];

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      for (const userToInvite of args.users) {
        const invitedUser = await this.walletsRepository.findOneByAddress(
          userToInvite.address,
          { user: true },
        );

        let invitedUserId = invitedUser?.id;

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

  public async updateStatus(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    status: UserOrganization['status'];
  }): Promise<void> {
    const signer = await this.getOrgAndSignerOrFail(args);

    if (signer.userOrg.status !== 'INVITED') {
      throw new ConflictException('Invite is not pending.');
    }

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbUserOrganization, signer.userOrg.id, {
        status: args.status,
      });

      const isActivatingUserOrg = args.status === 'ACTIVE';
      const isUserPending = signer.user.status === 'PENDING';
      if (isActivatingUserOrg && isUserPending) {
        await entityManager.update(DbUser, signer.user.id, {
          status: 'ACTIVE',
        });
      }
    });
  }

  public async get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>> {
    const signer = await this.getOrgAndSignerOrFail(args);
    return signer.org.userOrganizations;
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    role: UserOrganization['role'];
  }): Promise<void> {
    const signer = await this.getOrgAndSignerOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);
    this.assertUserOrgAdmin(signer.userOrg);
    if (args.role !== 'ADMIN') {
      this.assertNotLastActiveAdmin(signer.org.userOrganizations, args.userId);
    }

    const updateUserOrg = this.findUserOrg({
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
    const signer = await this.getOrgAndSignerOrFail(args);

    this.assertUserOrgIsActive(signer.userOrg);
    this.assertUserOrgAdmin(signer.userOrg);
    this.assertNotLastActiveAdmin(signer.org.userOrganizations, args.userId);

    const updateUserOrg = this.findUserOrg({
      userOrgs: signer.org.userOrganizations,
      userId: args.userId,
    });

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);
    await userOrganizationRepository.delete(updateUserOrg.id);
  }

  private async getOrgAndSignerOrFail(args: {
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
    const userOrg = this.findUserOrg({
      userOrgs: org.userOrganizations,
      userId: user.id,
    });

    return { org, user, userOrg };
  }

  private findUserOrg(args: {
    userOrgs: Array<UserOrganization>;
    userId: User['id'];
  }): UserOrganization {
    const userOrg = args.userOrgs.find((userOrg) => {
      return userOrg.user.id === args.userId;
    });
    if (!userOrg) {
      throw new NotFoundException('Member not found.');
    }
    return userOrg;
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  private assertUserOrgIsActive(
    userOrg: UserOrganization,
  ): asserts userOrg is UserOrganization & {
    status: 'ACTIVE';
  } {
    if (userOrg.status !== 'ACTIVE') {
      throw new UnauthorizedException('Member is not active.');
    }
  }

  private assertUserOrgAdmin(
    userOrg: UserOrganization,
  ): asserts userOrg is UserOrganization & {
    role: UserOrganizationRole.ADMIN;
  } {
    if (userOrg.role !== 'ADMIN') {
      throw new UnauthorizedException('Member is not an admin.');
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
