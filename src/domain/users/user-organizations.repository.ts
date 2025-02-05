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

  public async inviteUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    walletAddress: `0x${string}`;
    role: UserOrganization['role'];
  }): Promise<
    Pick<UserOrganization, 'role' | 'status'> & {
      userId: User['id'];
      orgId: Organization['id'];
    }
  > {
    this.assertSignerAddress(args.authPayload);

    const organization = await this.organizationsRepository.findOneOrFail(
      { id: args.orgId },
      { user_organizations: true },
    );

    const userOrganization = organization.user_organizations.find(
      ({ user }) => {
        return user.wallets.some((wallet) => {
          return args.authPayload.isForSigner(wallet.address);
        });
      },
    );

    if (userOrganization?.role !== UserOrganizationRole.ADMIN) {
      throw new UnauthorizedException('Signer is not an admin.');
    }

    this.assertIsMember({
      address: args.walletAddress,
      userOrganization,
    });

    const user = await this.usersRepository.findByWalletAddress(
      args.walletAddress,
    );

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    const insertResult = await userOrganizationRepository.insert({
      user,
      organization,
      role: args.role,
      // User must accept invite
      status: UserOrganizationStatus.PENDING,
    });

    return {
      userId: user.id,
      orgId: organization.id,
      role: args.role,
      status: insertResult.identifiers[0].status,
    };
  }

  public async updateStatus(args: {
    authPayload: AuthPayload;
    _orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
    status: UserOrganization['status'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const userOrganization = await this.findOneOrFail(
      { id: args.userOrgId },
      { user: true },
    );

    if (userOrganization.status !== UserOrganizationStatus.PENDING) {
      throw new ConflictException('Invite is not pending.');
    }

    this.assertIsMember({
      address: args.authPayload.signer_address,
      userOrganization,
    });

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    await userOrganizationRepository.update(
      { id: args.userOrgId },
      { status: args.status },
    );
  }

  public async get(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
  }): Promise<Array<UserOrganization>> {
    this.assertSignerAddress(args.authPayload);

    const organization = await this.organizationsRepository.findOneOrFail(
      { id: args.orgId },
      { user_organizations: true },
    );

    const isMember = organization.user_organizations.some(
      (userOrganization) => {
        return this.isMember({
          // Asserted above
          address: args.authPayload.signer_address!,
          userOrganization,
        });
      },
    );

    if (!isMember) {
      throw new UnauthorizedException('Signer is not a member.');
    }

    return organization.user_organizations;
  }

  public async updateRole(args: {
    authPayload: AuthPayload;
    _orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
    role: UserOrganization['role'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const userOrganization = await this.findOneOrFail({ id: args.userOrgId });

    this.assertIsMember({
      address: args.authPayload.signer_address,
      userOrganization,
    });

    if (userOrganization.role !== UserOrganizationRole.ADMIN) {
      throw new UnauthorizedException('Signer is not an admin.');
    }

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    await userOrganizationRepository.update(
      { id: args.userOrgId },
      { role: args.role },
    );
  }

  public async removeUser(args: {
    authPayload: AuthPayload;
    orgId: Organization['id'];
    userOrgId: UserOrganization['id'];
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);

    const userOrganization = await this.findOneOrFail({ id: args.orgId });

    this.assertIsMember({
      address: args.authPayload.signer_address,
      userOrganization,
    });

    if (userOrganization.role !== UserOrganizationRole.ADMIN) {
      throw new UnauthorizedException('Signer is not an admin.');
    }

    // TODO: Should we also delete the org upon deletion of the last orgUser?

    const userOrganizationRepository =
      await this.postgresDatabaseService.getRepository(DbUserOrganization);

    await userOrganizationRepository.delete(args.userOrgId);
  }

  private assertIsMember(args: {
    address: `0x${string}`;
    userOrganization: DbUserOrganization;
  }): void {
    if (!this.isMember(args)) {
      throw new UnauthorizedException('User is not a member.');
    }
  }

  private isMember(args: {
    address: `0x${string}`;
    userOrganization: DbUserOrganization;
  }): boolean {
    return args.userOrganization.user.wallets.some((wallet) => {
      return isAddressEqual(args.address, wallet.address);
    });
  }

  // TODO: Look into improving AuthGuard types to ensure this is always set
  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }
}
