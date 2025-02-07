import type { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import type { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import type { GetOrganizationResponse } from '@/routes/organizations/entities/get-organization.dto.entity';
import type {
  UpdateOrganizationDto,
  UpdateOrganizationResponse,
} from '@/routes/organizations/entities/update-organization.dto.entity';
import { UnauthorizedException } from '@nestjs/common';

export class UserOrganizationsService {
  public constructor(
    private readonly userRepository: IUsersRepository,
    private readonly organizationsRepository: IOrganizationsRepository,
  ) {}

  public async create(args: {
    name: Organization['name'];
    status: Organization['status'];
    authPayload: AuthPayload;
  }): ReturnType<IOrganizationsRepository['create']> {
    this.assertSignerAddress(args.authPayload);
    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    return await this.organizationsRepository.create({ userId, ...args });
  }

  public async get(
    authPayload: AuthPayload,
  ): Promise<Array<GetOrganizationResponse>> {
    this.assertSignerAddress(authPayload);

    const { id: userId } =
      await this.userRepository.getWithWallets(authPayload);

    return await this.organizationsRepository.findByUserIdOrFail({
      userId,
      select: {
        // id: true,
        // name: true,
        // status: true,
        // user_organizations: {
        //   id: true,
        //   role: true,
        //   status: true,
        //   created_at: true,
        //   updated_at: true,
        //   user: {
        //     id: true,
        //     status: true,
        //   },
        // },
      },
      relations: {
        user_organizations: {
          user: true,
        },
      },
    });
  }

  public async getOne(
    id: number,
    authPayload: AuthPayload,
  ): Promise<GetOrganizationResponse> {
    this.assertSignerAddress(authPayload);

    const { id: userId } =
      await this.userRepository.getWithWallets(authPayload);

    return await this.organizationsRepository.findOneOrFail({
      where: {
        id,
        user_organizations: {
          user: {
            id: userId,
          },
        },
      },
      select: {
        // id: true,
        // name: true,
        // status: true,
        // user_organizations: {
        //   id: true,
        //   role: true,
        //   status: true,
        //   created_at: true,
        //   updated_at: true,
        //   user: {
        //     id: true,
        //     status: true,
        //   },
        // },
      },
      relations: {
        user_organizations: {
          user: true,
        },
      },
    });
  }

  public async update(args: {
    id: Organization['id'];
    updatePayload: UpdateOrganizationDto;
    authPayload: AuthPayload;
  }): Promise<UpdateOrganizationResponse> {
    this.assertSignerAddress(args.authPayload);
    await this.assertOrganizationAdmin(
      args.id,
      args.authPayload.signer_address,
    );

    return await this.organizationsRepository.update(args);
  }

  public async delete(args: {
    id: Organization['id'];
    authPayload: AuthPayload;
  }): ReturnType<IOrganizationsRepository['delete']> {
    this.assertSignerAddress(args.authPayload);
    await this.assertOrganizationAdmin(
      args.id,
      args.authPayload.signer_address,
    );

    return await this.organizationsRepository.delete(args);
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  public async assertOrganizationAdmin(
    organizationId: Organization['id'],
    signerAddress: `0x${string}`,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const organization = await this.organizationsRepository.findOne({
      where: {
        id: organizationId,
        user_organizations: {
          role: UserOrganizationRole.ADMIN,
          user: {
            id: userId,
          },
        },
      },
    });

    if (!organization) {
      throw new UnauthorizedException(
        'User is unauthorized. SignerAddress= ' + organizationId,
      );
    }
  }
}
