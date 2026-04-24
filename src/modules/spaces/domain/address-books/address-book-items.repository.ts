// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AddressBookItem as DbAddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';
import { isAddressEqual } from 'viem';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  private readonly maxItems: number;

  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
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
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
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
        userId,
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
        userId,
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
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

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
    userId: number;
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
        lastUpdatedBy: args.userId,
      });
    }
    return existingAddressBookItems.map((item) => item.address);
  }

  private async createNewAddressBookItems(args: {
    userId: number;
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
        createdBy: args.userId,
        lastUpdatedBy: args.userId,
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
