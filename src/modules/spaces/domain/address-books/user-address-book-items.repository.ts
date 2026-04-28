// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { UserAddressBookItem as DbUserAddressBookItem } from '@/modules/spaces/datasources/entities/user-address-book-item.entity.db';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import type { UserAddressBookItem } from '@/modules/spaces/domain/address-books/entities/user-address-book-item.entity';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import { isAddressEqual, type Address } from 'viem';

@Injectable()
export class UserAddressBookItemsRepository implements IUserAddressBookItemsRepository {
  private readonly maxItems: number;

  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findBySpaceAndCreator(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
  }): Promise<Array<UserAddressBookItem>> {
    const repository = await this.db.getRepository(DbUserAddressBookItem);
    return repository.findBy({
      space: { id: args.spaceId },
      creator: { id: args.creatorId },
    });
  }

  public async findOneBySpaceCreatorAndAddress(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    address: UserAddressBookItem['address'];
  }): Promise<UserAddressBookItem | null> {
    const repository = await this.db.getRepository(DbUserAddressBookItem);
    return repository.findOneBy({
      space: { id: args.spaceId },
      creator: { id: args.creatorId },
      address: args.address,
    });
  }

  public async upsertMany(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    signerAddress: Address;
    items: Array<AddressBookItem>;
  }): Promise<Array<UserAddressBookItem>> {
    const repository = await this.db.getRepository(DbUserAddressBookItem);

    await this.db.transaction(async (entityManager) => {
      const existingAddresses = await this.updateExisting({
        entityManager,
        ...args,
      });

      const newItems = args.items.filter(
        (item) =>
          !existingAddresses.some((existing) =>
            isAddressEqual(existing, item.address),
          ),
      );

      if (newItems.length > 0) {
        await this.assertItemsLimitNotReached({
          entityManager,
          spaceId: args.spaceId,
          creatorId: args.creatorId,
          newItemsCount: newItems.length,
        });
        await entityManager.getRepository(DbUserAddressBookItem).insert(
          newItems.map((item) => ({
            space: { id: args.spaceId },
            creator: { id: args.creatorId },
            createdBy: args.signerAddress,
            address: item.address,
            name: item.name,
            chainIds: item.chainIds,
          })),
        );
      }
    });

    return repository.findBy({
      space: { id: args.spaceId },
      creator: { id: args.creatorId },
    });
  }

  public async deleteByAddress(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    address: UserAddressBookItem['address'];
  }): Promise<void> {
    const repository = await this.db.getRepository(DbUserAddressBookItem);
    await repository.delete({
      space: { id: args.spaceId },
      creator: { id: args.creatorId },
      address: args.address,
    });
  }

  private async updateExisting(args: {
    entityManager: EntityManager;
    spaceId: Space['id'];
    creatorId: User['id'];
    items: Array<AddressBookItem>;
  }): Promise<Array<UserAddressBookItem['address']>> {
    const repository = args.entityManager.getRepository(DbUserAddressBookItem);
    const existing = await repository.findBy({
      space: { id: args.spaceId },
      creator: { id: args.creatorId },
      address: In(args.items.map((item) => item.address)),
    });

    const updates = existing.flatMap((item) => {
      const patch = args.items.find((i) =>
        isAddressEqual(i.address, item.address),
      );
      if (!patch) return [];
      return [
        repository.update(item.id, {
          name: patch.name,
          chainIds: patch.chainIds,
        }),
      ];
    });
    await Promise.all(updates);

    return existing.map((item) => item.address);
  }

  private async assertItemsLimitNotReached(args: {
    entityManager: EntityManager;
    spaceId: Space['id'];
    creatorId: User['id'];
    newItemsCount: number;
  }): Promise<void> {
    const repository = args.entityManager.getRepository(DbUserAddressBookItem);
    const existingCount = await repository.count({
      where: {
        space: { id: args.spaceId },
        creator: { id: args.creatorId },
      },
    });
    if (existingCount + args.newItemsCount > this.maxItems) {
      throw new BadRequestException(
        `This Space only allows a maximum of ${this.maxItems} private contacts per user. You can only add up to ${this.maxItems - existingCount} more.`,
      );
    }
  }
}
