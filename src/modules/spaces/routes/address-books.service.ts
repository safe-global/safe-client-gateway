// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import type { SpaceAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

@Injectable()
export class AddressBooksService {
  private static readonly DELETED_USER_LABEL = 'Deleted user';
  private static readonly UNKNOWN_USER_LABEL = 'Unknown user';
  // TODO: Investigate and implement usage of this
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: <>
  private readonly maxItems: number;

  constructor(
    @Inject(IAddressBookItemsRepository)
    private readonly repository: IAddressBookItemsRepository,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IWalletsRepository)
    private readonly walletsRepository: IWalletsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const addressBookItems = await this.repository.findAllBySpaceId({
      authPayload,
      spaceId,
    });
    const userIdentityMap = await this.buildUserIdentityMap(addressBookItems);

    return this.mapAddressBookItems(spaceId, addressBookItems, userIdentityMap);
  }

  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    const updatedItems = await this.repository.upsertMany({
      authPayload,
      spaceId,
      addressBookItems: addressBookItems.items,
    });
    const userIdentityMap = await this.buildUserIdentityMap(updatedItems);

    return this.mapAddressBookItems(spaceId, updatedItems, userIdentityMap);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    await this.repository.deleteByAddress(args);
  }

  /**
   * Loads users for all unique user IDs in createdBy/lastUpdatedBy,
   * and builds a map: userId → first wallet address or email.
   */
  private async buildUserIdentityMap(
    items: Array<AddressBookDbItem>,
  ): Promise<Map<number, string>> {
    const userIds = [
      ...new Set(items.flatMap((item) => [item.createdBy, item.lastUpdatedBy])),
    ];
    if (userIds.length === 0) return new Map();

    const [users, wallets] = await Promise.all([
      this.usersRepository.find({ id: In(userIds) }),
      this.walletsRepository.find({
        where: { user: { id: In(userIds) } },
        relations: { user: true },
      }),
    ]);

    const walletAddressByUserId = new Map<number, string>();
    for (const wallet of wallets) {
      if (!walletAddressByUserId.has(wallet.user.id)) {
        walletAddressByUserId.set(wallet.user.id, wallet.address);
      }
    }

    return new Map(
      users.map((user): [number, string] => [
        user.id,
        walletAddressByUserId.get(user.id) ??
          user.email ??
          AddressBooksService.UNKNOWN_USER_LABEL,
      ]),
    );
  }

  private mapAddressBookItems(
    spaceId: Space['id'],
    items: Array<AddressBookDbItem>,
    userIdentityMap: Map<number, string>,
  ): SpaceAddressBookDto {
    const data = items.map((item) => ({
      name: item.name,
      address: item.address,
      chainIds: item.chainIds,
      createdBy:
        userIdentityMap.get(item.createdBy) ??
        AddressBooksService.DELETED_USER_LABEL,
      createdByUserId: item.createdBy,
      lastUpdatedBy:
        userIdentityMap.get(item.lastUpdatedBy) ??
        AddressBooksService.DELETED_USER_LABEL,
      lastUpdatedByUserId: item.lastUpdatedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      spaceId: spaceId.toString(),
      data,
    };
  }
}
