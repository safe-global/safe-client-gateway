// SPDX-License-Identifier: FSL-1.1-MIT

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Address } from 'viem';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import type { AddressBookRequest } from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  AddressBookRequestItemDto,
  AddressBookRequestsDto,
} from '@/modules/spaces/routes/entities/address-book-request.dto.entity';
import {
  assertAdmin,
  assertMember,
  isAdmin,
} from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver.service';

@Injectable()
export class AddressBookRequestsService {
  constructor(
    @Inject(IAddressBookRequestsRepository)
    private readonly requestsRepository: IAddressBookRequestsRepository,
    @Inject(IUserAddressBookItemsRepository)
    private readonly privateRepository: IUserAddressBookItemsRepository,
    @Inject(IAddressBookItemsRepository)
    private readonly spaceAddressBookRepository: IAddressBookItemsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(UserIdentityResolverService)
    private readonly identityResolver: UserIdentityResolverService,
  ) {}

  public async getNumericId(uuid: string): Promise<Space['id']> {
    return await this.spacesRepository.findIdByUuid(uuid);
  }

  // TODO: remove after FE removes numeric Space ID fallback.
  public async getNumericIdLenient(value: string): Promise<Space['id']> {
    return await this.spacesRepository.findIdByIdOrUuid(value);
  }

  public async findPending(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<AddressBookRequestsDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const callerIsAdmin = await isAdmin(this.spacesRepository, spaceId, userId);

    const requests = callerIsAdmin
      ? await this.requestsRepository.findBySpaceId({
          spaceId,
          status: 'PENDING',
        })
      : await this.requestsRepository.findBySpaceAndRequester({
          spaceId,
          requestedById: userId,
          status: 'PENDING',
        });

    return this.mapRequests(spaceId, requests);
  }

  public async createRequest(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    address: Address,
  ): Promise<AddressBookRequestItemDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const privateContact =
      await this.privateRepository.findOneBySpaceCreatorAndAddress({
        spaceId,
        creatorId: userId,
        address,
      });

    if (!privateContact) {
      throw new NotFoundException(
        'Private contact not found. Create a private contact first.',
      );
    }

    const request = await this.requestsRepository.create({
      spaceId,
      requestedById: userId,
      item: {
        name: privateContact.name,
        address: privateContact.address,
        chainIds: privateContact.chainIds,
      },
    });

    const { data } = await this.mapRequests(spaceId, [request]);
    return data[0];
  }

  public async approve(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    requestId: number,
  ): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.spacesRepository, spaceId, userId);

    const request = await this.requestsRepository.findOneOrFail({
      id: requestId,
      spaceId,
    });

    const claimed = await this.requestsRepository.transitionFromPending({
      id: requestId,
      spaceId,
      toStatus: 'APPROVED',
      reviewedBy: userId,
    });
    if (!claimed) {
      throw new BadRequestException('Only pending requests can be approved.');
    }

    try {
      await this.spaceAddressBookRepository.upsertMany({
        authPayload,
        spaceId,
        addressBookItems: [
          {
            name: request.name,
            address: request.address,
            chainIds: request.chainIds,
          },
        ],
        createdByOverride: request.requestedBy.id,
      });
    } catch (err) {
      await this.requestsRepository.revertToPending({
        id: requestId,
        spaceId,
      });
      throw err;
    }
  }

  public async reject(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    requestId: number,
  ): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.spacesRepository, spaceId, userId);

    const rejected = await this.requestsRepository.transitionFromPending({
      id: requestId,
      spaceId,
      toStatus: 'REJECTED',
      reviewedBy: userId,
    });
    if (!rejected) {
      throw new BadRequestException('Only pending requests can be rejected.');
    }
  }

  private async mapRequests(
    spaceId: Space['id'],
    requests: Array<AddressBookRequest>,
  ): Promise<AddressBookRequestsDto> {
    const identityMap = await this.identityResolver.resolveMany(
      requests.flatMap((r) =>
        r.reviewedBy !== null
          ? [r.requestedBy.id, r.reviewedBy]
          : [r.requestedBy.id],
      ),
    );

    return {
      spaceId: spaceId.toString(),
      data: requests.map((request) => this.toDto(request, identityMap)),
    };
  }

  private toDto(
    request: AddressBookRequest,
    identityMap: Map<number, string>,
  ): AddressBookRequestItemDto {
    return {
      id: request.id,
      name: request.name,
      address: request.address,
      chainIds: request.chainIds,
      requestedBy:
        identityMap.get(request.requestedBy.id) ??
        UserIdentityResolverService.DELETED_USER_LABEL,
      requestedByUserId: request.requestedBy.id,
      reviewedBy:
        request.reviewedBy === null
          ? null
          : (identityMap.get(request.reviewedBy) ??
            UserIdentityResolverService.DELETED_USER_LABEL),
      reviewedByUserId: request.reviewedBy,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
