// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { UserAddressBookItem } from '@/modules/spaces/domain/address-books/entities/user-address-book-item.entity';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { UserAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver.service';

@Injectable()
export class UserAddressBookService {
  constructor(
    @Inject(IUserAddressBookItemsRepository)
    private readonly repository: IUserAddressBookItemsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(UserIdentityResolverService)
    private readonly identityResolver: UserIdentityResolverService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  public async getNumericId(uuid: string): Promise<Space['id']> {
    return await this.spacesRepository.findIdByUuid(uuid);
  }

  public async findAll(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<UserAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const items = await this.repository.findBySpaceAndCreator({
      spaceId,
      creatorId: userId,
    });

    return this.mapItems(spaceId, userId, items);
  }

  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    dto: UpsertAddressBookItemsDto,
  ): Promise<UserAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const items = await this.repository.upsertMany({
      spaceId,
      creatorId: userId,
      items: dto.items,
    });

    return this.mapItems(spaceId, userId, items);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: UserAddressBookItem['address'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    await this.repository.deleteByAddress({
      spaceId: args.spaceId,
      creatorId: userId,
      address: args.address,
    });
  }

  private async mapItems(
    spaceId: Space['id'],
    userId: number,
    items: Array<UserAddressBookItem>,
  ): Promise<UserAddressBookDto> {
    const identityMap = await this.identityResolver.resolveMany([userId]);
    const createdBy =
      identityMap.get(userId) ?? UserIdentityResolverService.DELETED_USER_LABEL;

    return {
      spaceId: spaceId.toString(),
      data: items.map((item) => ({
        name: item.name,
        address: item.address,
        chainIds: item.chainIds,
        createdBy,
        createdByUserId: userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }
}
