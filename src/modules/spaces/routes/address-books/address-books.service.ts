// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { IAddressBookTagsRepository } from '#/modules/spaces/domain/address-books/address-book-tags.repository.interface';
import type { AddressBookDbItem } from '#/modules/spaces/domain/address-books/entities/address-book-item.db.entity';
import type { AddressBookTag } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import {
  assertAdmin,
  assertMember,
} from '#/modules/spaces/domain/space-assert.utils';
import { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import type {
  RenameTagDto,
  SetContactTagsDto,
} from '#/modules/spaces/routes/address-books/entities/address-book-tags.dto.entity';
import type { SpaceAddressBookDto } from '#/modules/spaces/routes/address-books/entities/space-address-book.dto.entity';
import type { UpsertAddressBookItemsDto } from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { UserIdentityResolverService } from '#/modules/users/domain/user-identity-resolver/user-identity-resolver.service';

@Injectable()
export class AddressBooksService {
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
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IAddressBookTagsRepository)
    private readonly tagsRepository: IAddressBookTagsRepository,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {
    this.maxItems = this.configurationService.getOrThrow<number>(
      'spaces.addressBooks.maxItems',
    );
  }

  public async findAllBySpaceId(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    return await this.getAddressBook(spaceId);
  }

  /**
   * Admin-only: name, address and chains. An item that carries `tags` also
   * gets that full tag set, in the same transaction; an item without `tags`
   * keeps its stored tags.
   */
  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertAdmin(this.membersRepository, spaceId, userId);

    const taggedItems = addressBookItems.items.flatMap((item) =>
      item.tags === undefined
        ? []
        : [{ address: item.address, tags: item.tags }],
    );
    if (taggedItems.length === 0) {
      // Saving contacts without tags: their tags stay the same
      const updated = await this.repository.upsertMany({
        userId,
        spaceId,
        addressBookItems: addressBookItems.items,
      });
      return this.mapAddressBookItems(spaceId, updated);
    }
    // Saving contacts with tags: contacts and tags are saved together
    const updated = await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Lock before writing contacts, so two admins saving at once cannot deadlock
        await this.tagsRepository.lockSpaceForTagWrites(entityManager, spaceId);
        const items = await this.repository.upsertMany({
          userId,
          spaceId,
          addressBookItems: addressBookItems.items,
          entityManager,
        });
        await this.tagsRepository.setTagsForItems({
          userId,
          spaceId,
          items: taggedItems,
          entityManager,
        });
        return items;
      },
    );
    return this.mapAddressBookItems(spaceId, updated);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: AddressBookDbItem['address'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    await this.repository.deleteByAddress({
      userId,
      spaceId: args.spaceId,
      address: args.address,
    });
  }

  /** Any active member: replaces the full tag set of each given contact. */
  public async setContactTags(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    dto: SetContactTagsDto,
  ): Promise<SpaceAddressBookDto> {
    // Each entry is a distinct contact of the book, so a valid batch is never
    // larger than the book's own limit.
    if (dto.items.length > this.maxItems) {
      throw new BadRequestException(
        `A tag update can change at most ${this.maxItems} contacts.`,
      );
    }
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    await this.tagsRepository.setTagsForItems({
      userId,
      spaceId,
      items: dto.items,
    });
    return await this.getAddressBook(spaceId);
  }

  /** Any active member. Renaming to another tag's name merges the two. */
  public async renameTag(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    tagId: AddressBookTag['id'];
    dto: RenameTagDto;
  }): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    await this.tagsRepository.renameTag({
      userId,
      spaceId: args.spaceId,
      tagId: args.tagId,
      name: args.dto.name,
    });
    return await this.getAddressBook(args.spaceId);
  }

  /** Any active member: deletes the tag and removes it from every contact. */
  public async deleteTag(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    tagId: AddressBookTag['id'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    await this.tagsRepository.deleteTag({
      userId,
      spaceId: args.spaceId,
      tagId: args.tagId,
    });
  }

  private async getAddressBook(
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const items = await this.repository.findAllBySpaceId(spaceId);
    return this.mapAddressBookItems(spaceId, items);
  }

  private async mapAddressBookItems(
    spaceId: Space['id'],
    items: Array<AddressBookDbItem>,
  ): Promise<SpaceAddressBookDto> {
    const [identityMap, spaceUuid, { tags, itemTagIds }] = await Promise.all([
      this.identityResolver.resolveMany(
        items.flatMap((item) => [item.createdBy, item.lastUpdatedBy]),
      ),
      this.spacesRepository.findUuidById(spaceId),
      this.tagsRepository.findBySpaceId(spaceId),
    ]);
    return {
      spaceUuid,
      data: items.map((item) => ({
        name: item.name,
        address: item.address,
        chainIds: item.chainIds,
        tagIds: itemTagIds.get(item.id) ?? [],
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
      tags,
    };
  }
}
