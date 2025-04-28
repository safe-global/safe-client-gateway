import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AddressBookItem as DbAddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/domain/spaces/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/domain/spaces/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '@/domain/spaces/address-books/entities/address-book-item.entity';
import { Space } from '@/domain/spaces/entities/space.entity';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { UpsertAddressBookItemsDto } from '@/routes/spaces/entities/upsert-address-book-items.dto.entity';
import { MemberRole } from '@/domain/users/entities/member.entity';
import { isAddressEqual } from 'viem';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  private readonly maxItems: number;

  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IUsersRepository)
    private readonly userRepository: IUsersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<Array<AddressBookDbItem>> {
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN', 'MEMBER'],
    });
    const repository = await this.db.getRepository(DbAddressBookItem);
    return repository.findBy({ space: { id: space.id } });
  }

  public async upsertMany(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    addressBookItems: UpsertAddressBookItemsDto['items'];
  }): Promise<Array<AddressBookDbItem>> {
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });
    const repository = await this.db.getRepository(DbAddressBookItem);
    await this.db.transaction(async (entityManager) => {
      const existingAddresses = await this.updateExistingAddressBookItems({
        entityManager,
        addressBookItems: args.addressBookItems,
        space,
        authPayload: args.authPayload,
      });

      const newAddressBookItems = args.addressBookItems.filter(
        (item) =>
          !existingAddresses.some((existingItem) =>
            isAddressEqual(existingItem, item.address),
          ),
      );

      await this.createNewAddressBookItems({
        entityManager,
        addressBookItems: newAddressBookItems,
        space,
        authPayload: args.authPayload,
      });
    });
    return repository.findBy({ space: { id: space.id } });
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });
    const repository = await this.db.getRepository(DbAddressBookItem);

    await repository.delete({
      address: args.address,
      space: { id: space.id },
    });
  }

  private async getSpaceAs(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    memberRoleIn: Array<keyof typeof MemberRole>;
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
        members: {
          status: In(['ACTIVE', 'INVITED']),
          role: In(args.memberRoleIn),
          user: { id: userId },
        },
      },
    });
  }

  private async updateExistingAddressBookItems(args: {
    authPayload: AuthPayload;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
  }): Promise<Array<DbAddressBookItem['address']>> {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const existingAddressBookItems = await repository.findBy({
      space: { id: args.space.id },
      address: In(args.addressBookItems.map((item) => item.address)),
    });
    for (const item of existingAddressBookItems) {
      const patch = args.addressBookItems.find((addressBookItem) =>
        isAddressEqual(addressBookItem.address, item.address),
      );
      if (!patch) {
        continue;
      }
      await repository.update(item.id, {
        name: patch.name,
        chainIds: patch.chainIds,
        lastUpdatedBy: args.authPayload.signer_address,
      });
    }
    return existingAddressBookItems.map((item) => item.address);
  }

  private async createNewAddressBookItems(args: {
    authPayload: AuthPayload;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
  }): Promise<Array<DbAddressBookItem['id']>> {
    await this.checkItemsLimit(args);
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const insertedIds = await repository.insert(
      args.addressBookItems.map((addressBookItem) => ({
        space: args.space,
        address: addressBookItem.address,
        name: addressBookItem.name,
        chainIds: addressBookItem.chainIds,
        createdBy: args.authPayload.signer_address,
        lastUpdatedBy: args.authPayload.signer_address,
      })),
    );
    return insertedIds.identifiers.map((i) => i.id);
  }

  private async checkItemsLimit(args: {
    space: Space;
    addressBookItems: Array<AddressBookItem>;
    entityManager: EntityManager;
  }): Promise<void> {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const existingAddressBookItems = await repository.count({
      where: { space: { id: args.space.id } },
    });
    const totalAddressBookItemsCount =
      existingAddressBookItems + args.addressBookItems.length;
    if (totalAddressBookItemsCount > this.maxItems) {
      throw new BadRequestException(
        `This Space only allows a maximum of ${this.maxItems} Address Book Items. You can only add up to ${this.maxItems - existingAddressBookItems} more.`,
      );
    }
  }
}
