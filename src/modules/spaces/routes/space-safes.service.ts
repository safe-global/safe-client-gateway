import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { CreateSpaceSafeDto } from '@/modules/spaces/routes/entities/create-space-safe.dto.entity';
import { DeleteSpaceSafeDto } from '@/modules/spaces/routes/entities/delete-space-safe.dto.entity';
import { GetSpaceSafeResponse } from '@/modules/spaces/routes/entities/get-space-safe.dto.entity';
import {
  SpaceMultisigTransactionPage,
  SpaceMultisigTransactionPageSchema,
} from '@/modules/spaces/routes/entities/get-space-multisig-transactions.dto.entity';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { groupBy, mapValues } from 'lodash';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { In } from 'typeorm';
import type { Address } from 'viem';

@Injectable()
export class SpaceSafesService {
  private static readonly MAX_PENDING_TX_LIMIT = 20;

  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) { }

  public async create(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<CreateSpaceSafeDto>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    await this.isAdmin(args.spaceId, args.authPayload.signer_address);

    return await this.spaceSafesRepository.create({
      spaceId: args.spaceId,
      payload: args.payload,
    });
  }

  public async get(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    this.assertSignerAddress(authPayload);
    await this.isMember(spaceId, authPayload.signer_address);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(spaceId);

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
      spaceId: args.spaceId,
      payload: args.payload,
    });
  }

  public async getPendingTransactions(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    limit?: number;
    offset?: number;
  }): Promise<SpaceMultisigTransactionPage> {
    this.assertSignerAddress(args.authPayload);
    await this.isMember(args.spaceId, args.authPayload.signer_address);

    const spaceSafes =
      await this.spaceSafesRepository.findBySpaceId(args.spaceId);

    if (spaceSafes.length === 0) {
      throw new NotFoundException('Space has no Safes.');
    }
    const mockSafes = ["0x8E2b4d4844364F844A6a292C313F58da38e2e137"]
    const safeAddresses = [
      // ...new Set(spaceSafes.map((safe) => safe.address)),
      ...mockSafes
    ];

    const limit = Math.min(
      args.limit ?? SpaceSafesService.MAX_PENDING_TX_LIMIT,
      SpaceSafesService.MAX_PENDING_TX_LIMIT,
    );

    try {
      const queueServiceBaseUri = this.configurationService.getOrThrow<string>('queueService.baseUri');

      const url = new URL(
        `${queueServiceBaseUri}/api/v1/multisig-transactions/`,
      );
      for (const safe of safeAddresses) {
        url.searchParams.append('safes', safe);
      }
      if (limit != null) {
        url.searchParams.append('limit', String(limit));
      }
      if (args.offset != null) {
        url.searchParams.append('offset', String(args.offset));
      }
      url.searchParams.append('executed', 'false');


      const { data } = await this.networkService.get<SpaceMultisigTransactionPage>({
        url: url.toString(),
      });
      console.log('### data --------------------------', data);
      return SpaceMultisigTransactionPageSchema.parse(data);
    } catch (error) {
      console.log('## error --------------------------', error);
      throw error;
    }
  }

  private assertSignerAddress(
    authPayload: AuthPayload,
  ): asserts authPayload is AuthPayload & { signer_address: Address } {
    if (!authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided');
    }
  }

  private async isAdmin(
    spaceId: Space['id'],
    signerAddress: Address,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const space = await this.spacesRepository.findOne({
      where: {
        id: spaceId,
        members: {
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
    signerAddress: Address,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const member = await this.membersRepository.findOne({
      user: { id: userId },
      space: { id: spaceId },
      status: In(['ACTIVE', 'INVITED']),
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
