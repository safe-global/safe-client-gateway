import type { Space } from '@/datasources/spaces/entities/space.entity.db';
import type { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import { MemberRole } from '@/domain/users/entities/member.entity';
import { User } from '@/domain/users/entities/user.entity';
import { IMembersRepository } from '@/domain/users/members.repository.interface';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { CreateSpaceResponse } from '@/routes/spaces/entities/create-space.dto.entity';
import type { GetSpaceResponse } from '@/routes/spaces/entities/get-space.dto.entity';
import type {
  UpdateSpaceDto,
  UpdateSpaceResponse,
} from '@/routes/spaces/entities/update-space.dto.entity';
import {
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { In } from 'typeorm';

export class SpacesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
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

  public async getActiveOrInvitedSpaces(
    authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    this.assertSignerAddress(authPayload);
    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      authPayload.signer_address,
    );
    const members = await this.membersRepository.find({
      where: { user: { id: userId }, status: In(['ACTIVE', 'INVITED']) },
      relations: ['space'],
    });
    return await this.spacesRepository.find({
      where: { id: In(members.map((member) => member.space.id)) },
      relations: { members: { user: true } },
    });
  }

  public async getActiveOrInvitedSpace(
    id: number,
    authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    this.assertSignerAddress(authPayload);
    const spaces = await this.getActiveOrInvitedSpaces(authPayload);
    const space = spaces.find((space) => space.id === id);
    if (!space) {
      throw new NotFoundException('Space not found.');
    }
    return space;
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
        members: {
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
