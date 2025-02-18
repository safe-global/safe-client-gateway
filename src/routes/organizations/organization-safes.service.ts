import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { CreateOrganizationSafeDto } from '@/routes/organizations/entities/create-organization-safe.dto.entity';
import { DeleteOrganizationSafeDto } from '@/routes/organizations/entities/delete-organization-safe.dto.entity';
import {
  GetOrganizationSafeResponse,
  GetOrganizationSafes,
} from '@/routes/organizations/entities/get-organization-safe.dto.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { groupBy, mapValues } from 'lodash';
import { IOrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository.interface';

@Injectable()
export class OrganizationSafesService {
  public constructor(
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(IOrganizationsRepository)
    private readonly organizationsRepository: IOrganizationsRepository,
    @Inject(IOrganizationSafesRepository)
    private readonly organizationSafesRepository: IOrganizationSafesRepository,
  ) {
    //
  }

  public async create(args: {
    organizationId: Organization['id'];
    authPayload: AuthPayload;
    payload: Array<CreateOrganizationSafeDto>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    await this.assertOrganizationAdmin(
      args.organizationId,
      args.authPayload.signer_address,
    );

    return await this.organizationSafesRepository.create({
      organizationId: args.organizationId,
      payload: args.payload,
    });
  }

  public async get(
    organizationId: Organization['id'],
    authPayload: AuthPayload,
  ): Promise<GetOrganizationSafeResponse> {
    this.assertSignerAddress(authPayload);
    await this.assertOrganizationAdmin(
      organizationId,
      authPayload.signer_address,
    );

    const organizationSafes =
      await this.organizationSafesRepository.findByOrganizationId(
        organizationId,
      );

    return {
      safes: this.transformOrganizationSafesResponse(organizationSafes),
    };
  }

  public async delete(args: {
    organizationId: Organization['id'];
    authPayload: AuthPayload;
    payload: Array<DeleteOrganizationSafeDto>;
  }): Promise<void> {
    this.assertSignerAddress(args.authPayload);
    await this.assertOrganizationAdmin(
      args.organizationId,
      args.authPayload.signer_address,
    );

    await this.organizationSafesRepository.delete({
      organizationId: args.organizationId,
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

  public async assertOrganizationAdmin(
    organizationId: Organization['id'],
    signerAddress: `0x${string}`,
  ): Promise<void> {
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);

    const organization = await this.organizationsRepository.findOne({
      where: {
        id: organizationId,
        userOrganizations: {
          role: 'ADMIN',
          user: {
            id: userId,
          },
        },
      },
    });

    if (!organization) {
      throw new UnauthorizedException(
        'User is unauthorized. signer_address= ' + signerAddress,
      );
    }
  }

  /**
   * Transforms the organization safes response.
   *
   * Transform from:
   *       [
   *          { chainId: 1, address: '0x123' }, { chainId: 1, address: '0x456' }, { chainId: 2, address: '0x789' }
   *      ],
   * To:
   *      { 1: ['0x123', '0x456'], 2: ['0x789'] }
   *
   * @param {Array<Pick<OrganizationSafe, 'chainId' | 'address'>>} organizationSafes
   *
   * @returns {GetOrganizationSafeResponse}
   */
  private transformOrganizationSafesResponse(
    organizationSafes: Array<Pick<OrganizationSafe, 'chainId' | 'address'>>,
  ): GetOrganizationSafes {
    const grouped = groupBy(organizationSafes, 'chainId');

    return mapValues(grouped, (items) => items.map((item) => item.address));
  }
}
