// SPDX-License-Identifier: FSL-1.1-MIT
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { IUserAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/user-address-book-items.repository.interface';
import { SpaceAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { UpsertAddressBookItemsDto } from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import type { UserAddressBookItem } from '@/modules/spaces/domain/address-books/entities/user-address-book-item.entity';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class UserAddressBookService {
  constructor(
    @Inject(IUserAddressBookItemsRepository)
    private readonly repository: IUserAddressBookItemsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  public async findAll(
    authPayload: AuthPayload,
    spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const items = await this.repository.findBySpaceAndCreator({
      spaceId,
      creatorId: userId,
    });

    return this.mapItems(spaceId, items);
  }

  public async upsertMany(
    authPayload: AuthPayload,
    spaceId: Space['id'],
    dto: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    if (!authPayload.isSiwe()) {
      throw new ForbiddenException(
        'Address book writes require wallet authentication',
      );
    }

    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const items = await this.repository.upsertMany({
      spaceId,
      creatorId: userId,
      signerAddress: authPayload.signer_address,
      items: dto.items,
    });

    return this.mapItems(spaceId, items);
  }

  public async deleteByAddress(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    address: UserAddressBookItem['address'];
  }): Promise<void> {
    if (!args.authPayload.isSiwe()) {
      throw new ForbiddenException(
        'Address book writes require wallet authentication',
      );
    }

    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    await this.repository.deleteByAddress({
      spaceId: args.spaceId,
      creatorId: userId,
      address: args.address,
    });
  }

  private mapItems(
    spaceId: Space['id'],
    items: Array<UserAddressBookItem>,
  ): SpaceAddressBookDto {
    const data = items.map((item) => ({
      name: item.name,
      address: item.address,
      chainIds: item.chainIds,
      createdBy: item.createdBy,
      lastUpdatedBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      spaceId: spaceId.toString(),
      data,
    };
  }
}
