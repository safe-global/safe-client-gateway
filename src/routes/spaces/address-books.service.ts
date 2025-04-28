import { IConfigurationService } from '@/config/configuration.service.interface';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { SpaceAddressBookDto } from '@/routes/spaces/entities/space-address-book.dto.entity';
import { Inject } from '@nestjs/common';
import { UpsertAddressBookItemsDto } from '@/routes/spaces/entities/upsert-address-book-items.dto.entity';
import type { AddressBookDbItem } from '@/domain/spaces/address-books/entities/address-book-item.db.entity';

export class AddressBooksService {
  // TODO: Investigate and implement usage of this
  private readonly maxItems: number;

  constructor(
    @Inject(IAddressBookItemsRepository)
    private readonly repository: IAddressBookItemsRepository,
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

    return this.mapAddressBookItems(spaceId, addressBookItems);
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

    return this.mapAddressBookItems(spaceId, updatedItems);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    await this.repository.deleteByAddress(args);
  }

  private mapAddressBookItems(
    spaceId: Space['id'],
    items: Array<AddressBookDbItem>,
  ): SpaceAddressBookDto {
    const data = items.map((item) => ({
      name: item.name,
      address: item.address,
      chainIds: item.chainIds,
      createdBy: item.createdBy,
      lastUpdatedBy: item.lastUpdatedBy,
    }));

    return {
      spaceId: spaceId.toString(),
      data,
    };
  }
}
