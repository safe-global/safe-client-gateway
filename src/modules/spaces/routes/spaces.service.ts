import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getEnumKey } from '@/domain/common/utils/enum';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { CreateSpaceResponse } from '@/modules/spaces/routes/entities/create-space.dto.entity';
import { SafesMode, type GetSpaceResponse } from '@/modules/spaces/routes/entities/get-space.dto.entity';
import type {
  UpdateSpaceDto,
  UpdateSpaceResponse,
} from '@/modules/spaces/routes/entities/update-space.dto.entity';
import {
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { In } from 'typeorm';
import type { Address } from 'viem';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';

export class SpacesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(SpaceSafesService)
    private readonly spaceSafesService: SpaceSafesService,
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
    safesMode?: SafesMode,
  ): Promise<Array<GetSpaceResponse>> {
    this.assertSignerAddress(authPayload);
    const { id: userId } = await this.userRepository.findByWalletAddressOrFail(
      authPayload.signer_address,
    );
    const members = await this.membersRepository.find({
      where: { user: { id: userId }, status: In(['ACTIVE', 'INVITED']) },
      relations: ['space'],
    });
    const spaces = await this.spacesRepository.find({
      where: { id: In(members.map((member) => member.space.id)) },
      relations: { members: { user: true } },
    });

    if (!safesMode) {
      return spaces.map((space) => ({
        id: space.id,
        name: space.name,
        status: space.status,
        members: space.members,
      }));
    }

    const result: Array<GetSpaceResponse> = [];

    for (const space of spaces) {
      const safesResponse = await this.spaceSafesService.get(
        space.id,
        authPayload,
      );

      const spaceWithSafes: GetSpaceResponse = {
        ...space,
        safes:
          safesMode === SafesMode.passCount
            ? this.spaceSafesService.countTotalSafes(safesResponse.safes)
            : safesResponse.safes,
      };

      result.push(spaceWithSafes);
    }

    return result;
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
  ): asserts authPayload is AuthPayload & { signer_address: Address } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  public async isAdmin(
    spaceId: Space['id'],
    signerAddress: Address,
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
