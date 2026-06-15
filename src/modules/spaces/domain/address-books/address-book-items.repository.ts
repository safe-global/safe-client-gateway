// SPDX-License-Identifier: FSL-1.1-MIT

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { isAddressEqual } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { AddressBookItem as DbAddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookDbItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { MemberRole } from '@/modules/users/domain/entities/member.entity';

@Injectable()
export class AddressBookItemsRepository implements IAddressBookItemsRepository {
  private readonly maxItems: number;

  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
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
    createdByOverride?: number;
    entityManager?: EntityManager;
  }): Promise<Array<AddressBookDbItem>> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });

    const run = async (
      entityManager: EntityManager,
    ): Promise<Array<AddressBookDbItem>> => {
      const updated = await this.updateExistingAddressBookItems({
        entityManager,
        addressBookItems: args.addressBookItems,
        space,
        userId,
      });

      const newAddressBookItems = args.addressBookItems.filter(
        (item) =>
          !updated.some((existingItem) =>
            isAddressEqual(existingItem.address, item.address),
          ),
      );

      await this.createNewAddressBookItems({
        entityManager,
        addressBookItems: newAddressBookItems,
        space,
        userId,
        createdByOverride: args.createdByOverride,
      });

      if (updated.length > 0 || newAddressBookItems.length > 0) {
        await this.spaceAuditRepository.record(entityManager, {
          spaceId: space.id,
          spaceUuid: space.uuid,
          eventType: SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
          actorUserId: userId,
          payload: {
            created: newAddressBookItems.map((item) => ({
              address: item.address,
              name: item.name,
            })),
            updated,
            ...(args.createdByOverride !== undefined && {
              onBehalfOfUserId: args.createdByOverride,
            }),
          },
        });
      }

      return entityManager.findBy(DbAddressBookItem, {
        space: { id: space.id },
      });
    };

    return args.entityManager
      ? await run(args.entityManager)
      : await this.db.transaction(run);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const space = await this.getSpaceAs({
      ...args,
      memberRoleIn: ['ADMIN'],
    });

    await this.db.transaction(async (entityManager) => {
      const item = await entityManager.findOne(DbAddressBookItem, {
        where: { address: args.address, space: { id: space.id } },
      });
      if (!item) {
        return;
      }

      await entityManager.delete(DbAddressBookItem, item.id);

      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.ADDRESS_BOOK_DELETED,
        actorUserId: userId,
        payload: { address: item.address, name: item.name },
      });
    });
  }

  private async getSpaceAs(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    memberRoleIn: Array<keyof typeof MemberRole>;
  }): Promise<Space> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    return await this.spacesRepository.findOneOrFail({
      where: {
        id: args.spaceId,
        members: {
          role: In(args.memberRoleIn),
          user: { id: userId },
          status: 'ACTIVE',
        },
      },
    });
  }

  /** @returns the updated items as `{ address, name }` pairs (new name). */
  private async updateExistingAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
  }): Promise<Array<Pick<DbAddressBookItem, 'address' | 'name'>>> {
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const existingAddressBookItems = await repository.findBy({
      space: { id: args.space.id },
      address: In(args.addressBookItems.map((item) => item.address)),
    });
    const updated: Array<Pick<DbAddressBookItem, 'address' | 'name'>> = [];
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
      updated.push({ address: item.address, name: patch.name });
    }
    return updated;
  }

  private async createNewAddressBookItems(args: {
    userId: number;
    addressBookItems: Array<AddressBookItem>;
    space: Space;
    entityManager: EntityManager;
    createdByOverride?: number;
  }): Promise<Array<DbAddressBookItem['id']>> {
    await this.checkItemsLimit(args);
    const repository = args.entityManager.getRepository(DbAddressBookItem);
    const insertedIds = await repository.insert(
      args.addressBookItems.map((addressBookItem) => ({
        space: args.space,
        address: addressBookItem.address,
        name: addressBookItem.name,
        chainIds: addressBookItem.chainIds,
        createdBy: args.createdByOverride ?? args.userId,
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
        `This Workspace only allows a maximum of ${this.maxItems} Address Book Items. You can only add up to ${this.maxItems - existingAddressBookItems} more.`,
      );
    }
  }
}
