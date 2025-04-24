import { IConfigurationService } from '@/config/configuration.service.interface';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { SpaceAddressBookDto } from '@/routes/spaces/entities/space-address-book.dto.entity';
import { Inject } from '@nestjs/common';
import { UpsertAddressBookItemsDto } from '@/routes/spaces/entities/upsert-address-book-items.dto.entity';

export class AddressBooksService {
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

    return {
      spaceId: spaceId.toString(),
      data: addressBookItems,
    };
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

    return {
      spaceId: spaceId.toString(),
      data: updatedItems,
    };
  }
}
