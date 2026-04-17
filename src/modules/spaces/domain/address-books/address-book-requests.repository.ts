// SPDX-License-Identifier: FSL-1.1-MIT
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { AddressBookRequest as DbAddressBookRequest } from '@/modules/spaces/datasources/entities/address-book-request.entity.db';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import type {
  AddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from 'viem';
import type { FindOptionsWhere, InsertResult } from 'typeorm';

@Injectable()
export class AddressBookRequestsRepository implements IAddressBookRequestsRepository {
  constructor(private readonly db: PostgresDatabaseService) {}

  public async findBySpaceId(args: {
    spaceId: Space['id'];
    status?: keyof typeof AddressBookRequestStatus;
  }): Promise<Array<AddressBookRequest>> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    const where: FindOptionsWhere<DbAddressBookRequest> = {
      space: { id: args.spaceId },
    };
    if (args.status) {
      where.status = args.status;
    }
    return repository.find({
      where,
      relations: ['requestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  public async findBySpaceAndRequester(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    status?: keyof typeof AddressBookRequestStatus;
  }): Promise<Array<AddressBookRequest>> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    const where: FindOptionsWhere<DbAddressBookRequest> = {
      space: { id: args.spaceId },
      requestedBy: { id: args.requestedById },
    };
    if (args.status) {
      where.status = args.status;
    }
    return repository.find({
      where,
      relations: ['requestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  public async findOneOrFail(args: {
    id: AddressBookRequest['id'];
    spaceId: Space['id'];
  }): Promise<AddressBookRequest> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    const request = await repository.findOne({
      where: {
        id: args.id,
        space: { id: args.spaceId },
      },
      relations: ['requestedBy'],
    });
    if (!request) {
      throw new NotFoundException('Address book request not found.');
    }
    return request;
  }

  public async create(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    requestedByWallet: Address;
    item: AddressBookItem;
  }): Promise<AddressBookRequest> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    let result: InsertResult;
    try {
      result = await repository.insert({
        space: { id: args.spaceId },
        requestedBy: { id: args.requestedById },
        requestedByWallet: args.requestedByWallet,
        address: args.item.address,
        name: args.item.name,
        chainIds: args.item.chainIds,
        status: 'PENDING',
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError(
          'A request for this address already exists.',
        );
      }
      throw err;
    }
    const insertedId = result.identifiers[0].id;
    return this.findOneOrFail({ id: insertedId, spaceId: args.spaceId });
  }

  public async updateStatus(args: {
    id: AddressBookRequest['id'];
    status: keyof typeof AddressBookRequestStatus;
    reviewedBy: Address;
  }): Promise<void> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    await repository.update(args.id, {
      status: args.status,
      reviewedBy: args.reviewedBy,
    });
  }
}
