import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import {
  AddressBookRequestsDto,
  AddressBookRequestItemDto,
} from '@/modules/spaces/routes/entities/address-book-request.dto.entity';
import { assertMember, assertAdmin } from '@/modules/spaces/routes/utils/space-assert.utils';
import type { AddressBookRequest } from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Address } from 'viem';

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
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
  ) {}

  public async findPending(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<AddressBookRequestsDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    // Check if user is admin to determine what they can see
    const isAdmin = await this.isSpaceAdmin(spaceId, userId);

    const requests = isAdmin
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
    if (!authPayload.isSiwe()) {
      throw new ForbiddenException(
        'Address book writes require wallet authentication',
      );
    }

    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    // Look up the private contact
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

    return this.mapRequestItem(request);
  }

  public async approve(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    requestId: number,
  ): Promise<void> {
    if (!authPayload.isSiwe()) {
      throw new ForbiddenException(
        'Address book writes require wallet authentication',
      );
    }

    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.spacesRepository, spaceId, userId);

    const request = await this.requestsRepository.findOneOrFail({
      id: requestId,
      spaceId,
    });

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be approved.');
    }

    // Look up the requester's private contact to get original author's wallet address
    const requesterId = request.requestedBy?.id;
    let createdByOverride: `0x${string}` | undefined;
    if (requesterId) {
      const privateContact =
        await this.privateRepository.findOneBySpaceCreatorAndAddress({
          spaceId,
          creatorId: requesterId,
          address: request.address,
        });
      if (privateContact?.createdBy) {
        createdByOverride = privateContact.createdBy;
      }
    }

    // Add to the shared space address book, preserving original author
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
      createdByOverride,
    });

    // Mark the request as approved
    await this.requestsRepository.updateStatus({
      id: requestId,
      status: 'APPROVED',
      reviewedBy: authPayload.signer_address as Address,
    });
  }

  public async reject(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    requestId: number,
  ): Promise<void> {
    if (!authPayload.isSiwe()) {
      throw new ForbiddenException(
        'Address book writes require wallet authentication',
      );
    }

    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.spacesRepository, spaceId, userId);

    const request = await this.requestsRepository.findOneOrFail({
      id: requestId,
      spaceId,
    });

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be rejected.');
    }

    await this.requestsRepository.updateStatus({
      id: requestId,
      status: 'REJECTED',
      reviewedBy: authPayload.signer_address as Address,
    });
  }

  private async isSpaceAdmin(
    spaceId: Space['id'],
    userId: number,
  ): Promise<boolean> {
    try {
      await assertAdmin(this.spacesRepository, spaceId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async mapRequests(
    spaceId: Space['id'],
    requests: Array<AddressBookRequest>,
  ): Promise<AddressBookRequestsDto> {
    const data = await Promise.all(
      requests.map((request) => this.mapRequestItem(request)),
    );
    return {
      spaceId: spaceId.toString(),
      data,
    };
  }

  private async mapRequestItem(
    request: AddressBookRequest,
  ): Promise<AddressBookRequestItemDto> {
    let requestedByAddress = '';
    if (request.requestedBy?.id) {
      const wallets = await this.walletsRepository.findByUser(
        request.requestedBy.id,
      );
      requestedByAddress = wallets[0]?.address ?? '';
    }

    return {
      id: request.id,
      name: request.name,
      address: request.address,
      chainIds: request.chainIds,
      requestedBy: requestedByAddress,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
