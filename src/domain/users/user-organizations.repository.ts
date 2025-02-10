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
import { UserStatus } from '@/domain/users/entities/user.entity';
import type { FindOptionsWhere, FindOptionsRelations } from 'typeorm';
import type { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import {
  UserOrganizationRole,
  UserOrganizationStatus,
} from '@/domain/users/entities/user-organization.entity';
import { getEnumKey } from '@/domain/common/utils/enums';
import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { User } from '@/domain/users/entities/user.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';

// TODO: Refactor

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
      role: UserOrganizationRole;
    }>;
  }): Promise<
    Array<{
      userId: User['id'];
      orgId: Organization['id'];
      role: keyof typeof UserOrganizationRole;
      status: keyof typeof UserOrganizationStatus;
    }>
  > {
    this.assertSignerAddress(args.authPayload);

    const signerUser = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { user_organizations: { user: true } },
    });

    const userOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === signerUser.id;
    });

    if (!userOrg) {
      throw new NotFoundException('Signer is not a member.');
    }

    if (userOrg.status !== UserOrganizationStatus.ACTIVE) {
      throw new ConflictException('Signer is not an active member.');
    }

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
            UserStatus.PENDING,
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
          role: userToInvite.role,
          status: UserOrganizationStatus.INVITED,
        });

        invitations.push({
          userId: invitedUserId,
          orgId: org.id,
          role: getEnumKey(UserOrganizationRole, userToInvite.role),
          status: getEnumKey(
            UserOrganizationStatus,
            UserOrganizationStatus.INVITED,
          ),
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
    this.assertSignerAddress(args.authPayload);

    const signerUser = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { user_organizations: { user: true } },
    });

    const userOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === signerUser.id;
    });

    if (!userOrg) {
      throw new UnauthorizedException('Signer is not a member.');
    }

    if (userOrg.status !== UserOrganizationStatus.INVITED) {
      throw new ConflictException('Invite is not pending.');
    }

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await entityManager.update(DbUserOrganization, userOrg.id, {
        status: args.status,
      });

      // TODO: Separate into own method?
      if (
        args.status === UserOrganizationStatus.ACTIVE &&
        signerUser.status !== UserStatus.ACTIVE
      ) {
        await entityManager.update(DbUser, signerUser.id, {
          status: UserStatus.ACTIVE,
        });
      }
    });
  }

  public async get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>> {
    this.assertSignerAddress(args.authPayload);

    const signerUser = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { user_organizations: { user: true } },
    });

    const userOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === signerUser.id;
    });

    if (!userOrg) {
      throw new UnauthorizedException('Signer is not a member.');
    }

    return org.user_organizations;
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userId: User['id'];
    role: UserOrganization['role'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const signerUser = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { user_organizations: { user: true } },
    });

    const signerUserOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === signerUser.id;
    });

    if (!signerUserOrg) {
      throw new UnauthorizedException('Signer is not a member.');
    }

    if (signerUserOrg.status !== UserOrganizationStatus.ACTIVE) {
      throw new UnauthorizedException('Signer is not an active member.');
    }

    if (signerUserOrg.role !== UserOrganizationRole.ADMIN) {
      throw new UnauthorizedException('Signer is not an admin.');
    }

    const updateUserOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === args.userId;
    });

    if (!updateUserOrg) {
      throw new NotFoundException('Member not found.');
    }

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
    this.assertSignerAddress(args.authPayload);

    const signerUser = await this.usersRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    const org = await this.organizationsRepository.findOneOrFail({
      where: { id: args.orgId },
      relations: { user_organizations: { user: true } },
    });

    const signerUserOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === signerUser.id;
    });

    if (!signerUserOrg) {
      throw new UnauthorizedException('Signer is not a member.');
    }

    if (signerUserOrg.status !== UserOrganizationStatus.ACTIVE) {
      throw new UnauthorizedException('Signer is not an active member.');
    }

    if (signerUserOrg.role !== UserOrganizationRole.ADMIN) {
      throw new UnauthorizedException('Signer is not an admin.');
    }

    const updateUserOrg = org.user_organizations.find((userOrg) => {
      return userOrg.user.id === args.userId;
    });

    if (!updateUserOrg) {
      throw new NotFoundException('Member not found.');
    }

    // TODO: Should we remove the org when removing the last user?

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    await userOrganizationRepository.delete(updateUserOrg.id);
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }
}
