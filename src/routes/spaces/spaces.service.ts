import type { Organization as Space } from '@/datasources/organizations/entities/organizations.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { IOrganizationsRepository as ISpacesRepository } from '@/domain/organizations/organizations.repository.interface';
import { UserOrganizationRole as MemberRole } from '@/domain/users/entities/user-organization.entity';
import { User } from '@/domain/users/entities/user.entity';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { CreateSpaceResponse } from '@/routes/spaces/entities/create-space.dto.entity';
import type { GetSpaceResponse } from '@/routes/spaces/entities/get-space.dto.entity';
import type {
  UpdateSpaceDto,
  UpdateSpaceResponse,
} from '@/routes/spaces/entities/update-space.dto.entity';
import { Inject, UnauthorizedException } from '@nestjs/common';

export class SpacesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  public async create(args: {
    name: Space['name'];
    status: Space['status'];
    authPayload: AuthPayload;
  }): Promise<CreateSpaceResponse> {
    this.assertSignerAddress(args.authPayload);
    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      args.authPayload.signer_address,
    );

    return await this.spacesRepository.create({ userId, ...args });
  }

  public async createWithUser(args: {
    name: Space['name'];
    status: Space['status'];
    userStatus: User['status'];
    authPayload: AuthPayload;
  }): Promise<CreateSpaceResponse> {
    this.assertSignerAddress(args.authPayload);
    const user = await this.userRepository.findByWalletAddress(
      args.authPayload.signer_address,
    );

    let userId: number;

    if (user) {
      userId = user.id;
    } else {
      const user = await this.userRepository.createWithWallet({
        status: args.userStatus,
        authPayload: args.authPayload,
      });

      userId = user.id;
    }

    return await this.spacesRepository.create({
      userId,
      ...args,
    });
  }

  public async get(authPayload: AuthPayload): Promise<Array<GetSpaceResponse>> {
    this.assertSignerAddress(authPayload);

    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      authPayload.signer_address,
    );

    const spaces = await this.spacesRepository.findByUserId({
      userId,
      select: {
        id: true,
        name: true,
        status: true,
        userOrganizations: {
          id: true,
          role: true,
          name: true,
          invitedBy: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            id: true,
            status: true,
          },
        },
      },
      relations: {
        userOrganizations: {
          user: true,
        },
      },
    });

    // TODO: (compatibility) remove this mapping and return findByUserId result directly after the rename.
    return spaces.map((space) => {
      return {
        id: space.id,
        name: space.name,
        status: space.status,
        members: space.userOrganizations.map((member) => {
          return {
            id: member.id,
            role: member.role,
            name: member.name,
            invitedBy: member.invitedBy,
            status: member.status,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
            user: {
              id: member.user.id,
              status: member.user.status,
            },
          };
        }),
      };
    });
  }

  public async getOne(
    id: number,
    authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    this.assertSignerAddress(authPayload);

    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      authPayload.signer_address,
    );

    const space = await this.spacesRepository.findOneOrFail({
      where: {
        id,
        userOrganizations: { user: { id: userId, status: 'ACTIVE' } },
      },
      select: {
        id: true,
        name: true,
        status: true,
        userOrganizations: {
          id: true,
          role: true,
          name: true,
          invitedBy: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            id: true,
            status: true,
          },
        },
      },
      relations: {
        userOrganizations: {
          user: true,
        },
      },
    });

    // TODO: (compatibility) remove this mapping and return findOneOrFail result directly after the rename.
    return {
      id: space.id,
      name: space.name,
      status: space.status,
      members: space.userOrganizations.map((member) => {
        return {
          id: member.id,
          role: member.role,
          name: member.name,
          invitedBy: member.invitedBy,
          status: member.status,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          user: {
            id: member.user.id,
            status: member.user.status,
          },
        };
      }),
    };
  }

  public async update(args: {
    id: Space['id'];
    updatePayload: UpdateSpaceDto;
    authPayload: AuthPayload;
  }): Promise<UpdateSpaceResponse> {
    this.assertSignerAddress(args.authPayload);
    await this.isAdmin(args.id, args.authPayload.signer_address);

    return await this.spacesRepository.update(args);
  }

  public async delete(args: {
    id: Space['id'];
    authPayload: AuthPayload;
  }): ReturnType<ISpacesRepository['delete']> {
    this.assertSignerAddress(args.authPayload);
    await this.isAdmin(args.id, args.authPayload.signer_address);

    return await this.spacesRepository.delete(args.id);
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  public async isAdmin(
    spaceId: Space['id'],
    signerAddress: `0x${string}`,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const space = await this.spacesRepository.findOne({
      where: {
        id: spaceId,
        userOrganizations: {
          role: getEnumKey(MemberRole, MemberRole.ADMIN),
          status: 'ACTIVE',
          user: {
            id: userId,
          },
        },
      },
    });

    if (!space) {
      throw new UnauthorizedException(
        'User is unauthorized. signer_address= ' + signerAddress,
      );
    }
  }
}
