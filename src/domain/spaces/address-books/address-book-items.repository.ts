import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AddressBookItem as DbAddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import type { AddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.entity';
import { Space } from '@/domain/spaces/entities/space.entity';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { In } from 'typeorm';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
  ) {}

  async findAllBySpaceId(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<AddressBookItem>> {
    const space = await this.getSpaceAsMember(args);
    const repository = await this.db.getRepository(DbAddressBookItem);
    return repository.findBy({ space: { id: space.id } });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: Array<AddressBookItem>;
  }): Promise<Array<AddressBookItem>> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItemIds: Array<string>;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async getSpaceAsMember(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Space> {
    // TODO: Move this assertion to the service
    if (!args.authPayload.signer_address) {
      throw new UnauthorizedException('Signer address not provided.');
    }
    const signerAddress = args.authPayload.signer_address;
    const { id: userId } =
      await this.userRepository.findByWalletAddressOrFail(signerAddress);
    return this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: { status: In(['ACTIVE', 'INVITED']), user: { id: userId } },
      },
    });
  }
}
