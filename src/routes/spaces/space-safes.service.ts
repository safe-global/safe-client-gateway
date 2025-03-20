import { Organization as Space } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationSafe as SpaceSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IOrganizationsRepository as ISpacesRepository } from '@/domain/organizations/organizations.repository.interface';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { CreateSpaceSafeDto } from '@/routes/spaces/entities/create-space-safe.dto.entity';
import { DeleteSpaceSafeDto } from '@/routes/spaces/entities/delete-space-safe.dto.entity';
import { GetSpaceSafeResponse } from '@/routes/spaces/entities/get-space-safe.dto.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { groupBy, mapValues } from 'lodash';
import { IOrganizationSafesRepository as ISpaceSafesRepository } from '@/domain/organizations/organizations-safe.repository.interface';
import { IUsersOrganizationsRepository as IMembersRepository } from '@/domain/users/user-organizations.repository.interface';

@Injectable()
export class SpaceSafesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  public async create(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<CreateSpaceSafeDto>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    await this.isAdmin(args.spaceId, args.authPayload.signer_address);

    return await this.spaceSafesRepository.create({
      organizationId: args.spaceId,
      payload: args.payload,
    });
  }

  public async get(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    this.assertSignerAddress(authPayload);
    await this.isMember(spaceId, authPayload.signer_address);

    const spaceSafes =
      await this.spaceSafesRepository.findByOrganizationId(spaceId);

    return {
      safes: this.transformSpaceSafesResponse(spaceSafes),
    };
  }

  public async delete(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<DeleteSpaceSafeDto>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    await this.isAdmin(args.spaceId, args.authPayload.signer_address);

    await this.spaceSafesRepository.delete({
      organizationId: args.spaceId,
      payload: args.payload,
    });
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: `0x${string}` } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  private async isAdmin(
    spaceId: Space['id'],
    signerAddress: `0x${string}`,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const space = await this.spacesRepository.findOne({
      where: {
        id: spaceId,
        userOrganizations: {
          role: 'ADMIN',
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

  private async isMember(
    spaceId: Space['id'],
    signerAddress: `0x${string}`,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const member = await this.membersRepository.findOne({
      user: { id: userId },
      organization: { id: spaceId },
    });

    if (!member) {
      throw new UnauthorizedException(
        'User is unauthorized. signer_address= ' + signerAddress,
      );
    }
  }

  /**
   * Transforms the space Safes response.
   *
   * Transform from:
   *       [
   *          { chainId: 1, address: '0x123' }, { chainId: 1, address: '0x456' }, { chainId: 2, address: '0x789' }
   *      ],
   * To:
   *      { 1: ['0x123', '0x456'], 2: ['0x789'] }
   *
   * @param {Array<Pick<SpaceSafe, 'chainId' | 'address'>>} spaceSafes
   *
   * @returns {GetSpaceSafeResponse}
   */
  private transformSpaceSafesResponse(
    spaceSafes: Array<Pick<SpaceSafe, 'chainId' | 'address'>>,
  ): GetSpaceSafeResponse['safes'] {
    const grouped = groupBy(spaceSafes, 'chainId');

    return mapValues(grouped, (items) => items.map((item) => item.address));
  }
}
