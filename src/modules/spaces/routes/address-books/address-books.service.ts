// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/domain/space-assert.utils';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { SpaceAddressBookDto } from '@/modules/spaces/routes/address-books/entities/space-address-book.dto.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.service';

@Injectable()
export class AddressBooksService {
  // TODO: Investigate and implement usage of this
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: <>
  private readonly maxItems: number;

  constructor(
    @Inject(IAddressBookItemsRepository)
    private readonly repository: IAddressBookItemsRepository,
    @Inject(UserIdentityResolverService)
    private readonly identityResolver: UserIdentityResolverService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const items = await this.repository.findAllBySpaceId(spaceId);
    return this.mapAddressBookItems(spaceId, items);
  }

  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.membersRepository, spaceId, userId);

    const updated = await this.repository.upsertMany({
      userId,
      spaceId,
      addressBookItems: addressBookItems.items,
    });
    return this.mapAddressBookItems(spaceId, updated);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    await this.repository.deleteByAddress({
      userId,
      spaceId: args.spaceId,
      address: args.address,
    });
  }

  private async mapAddressBookItems(
    spaceId: Space['id'],
    items: Array<AddressBookDbItem>,
  ): Promise<SpaceAddressBookDto> {
    const [identityMap, spaceUuid] = await Promise.all([
      this.identityResolver.resolveMany(
        items.flatMap((item) => [item.createdBy, item.lastUpdatedBy]),
      ),
      this.spacesRepository.findUuidById(spaceId),
    ]);
    return {
      spaceUuid,
      data: items.map((item) => ({
        name: item.name,
        address: item.address,
        chainIds: item.chainIds,
        createdBy:
          identityMap.get(item.createdBy) ??
          UserIdentityResolverService.DELETED_USER_LABEL,
        createdByUserId: item.createdBy,
        lastUpdatedBy:
          identityMap.get(item.lastUpdatedBy) ??
          UserIdentityResolverService.DELETED_USER_LABEL,
        lastUpdatedByUserId: item.lastUpdatedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }
}
