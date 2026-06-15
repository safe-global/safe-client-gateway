// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { SpaceAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver.service';

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
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const items = await this.repository.findAllBySpaceId({
      authPayload,
      spaceId,
    });
    const identityMap = await this.identityResolver.resolveMany(
      items.flatMap((item) => [item.createdBy, item.lastUpdatedBy]),
    );
    return this.mapAddressBookItems(spaceId, items, identityMap);
  }

  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    const updated = await this.repository.upsertMany({
      authPayload,
      spaceId,
      addressBookItems: addressBookItems.items,
    });
    const identityMap = await this.identityResolver.resolveMany(
      updated.flatMap((item) => [item.createdBy, item.lastUpdatedBy]),
    );
    return this.mapAddressBookItems(spaceId, updated, identityMap);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    await this.repository.deleteByAddress(args);
  }

  private async mapAddressBookItems(
    spaceId: Space['id'],
    items: Array<AddressBookDbItem>,
    identityMap: Map<number, string>,
  ): Promise<SpaceAddressBookDto> {
    const spaceUuid = await this.spacesRepository.findUuidById(spaceId);
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
