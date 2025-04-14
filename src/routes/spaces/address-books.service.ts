import { IConfigurationService } from '@/config/configuration.service.interface';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import { SpaceAddressBookDto } from '@/routes/spaces/entities/space-address-book.dto.entity';
import { Inject } from '@nestjs/common';

export class AddressBooksService {
  private readonly maxAddressBookItems: number;

  constructor(
    @Inject(IAddressBookItemsRepository)
    private readonly repository: IAddressBookItemsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxAddressBookItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxAddressBookItems',
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
}
