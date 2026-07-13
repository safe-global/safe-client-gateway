// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager, FindOptionsWhere, InsertResult } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { AddressBookRequest as DbAddressBookRequest } from '@/modules/spaces/datasources/address-books/entities/address-book-request.entity.db';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type {
  AddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';
import type { User } from '@/modules/users/domain/entities/user.entity';

@Injectable()
export class AddressBookRequestsRepository
  implements IAddressBookRequestsRepository
{
  constructor(
    private readonly db: PostgresDatabaseService,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {}

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
    const requests = await repository.find({
      where,
      relations: { requestedBy: true },
      order: { createdAt: 'DESC' },
    });
    // Repository boundary: callers receive plaintext address + name.
    return await this.spaceEncryptionService.decryptAddressBookRequests(
      args.spaceId,
      requests,
    );
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
    const requests = await repository.find({
      where,
      relations: { requestedBy: true },
      order: { createdAt: 'DESC' },
    });
    // Repository boundary: callers receive plaintext address + name.
    return await this.spaceEncryptionService.decryptAddressBookRequests(
      args.spaceId,
      requests,
    );
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
      relations: { requestedBy: true },
    });
    if (!request) {
      throw new NotFoundException('Address book request not found.');
    }
    // Repository boundary: callers receive plaintext address + name.
    const [decrypted] =
      await this.spaceEncryptionService.decryptAddressBookRequests(
        args.spaceId,
        [request],
      );
    return decrypted;
  }

  public async countPending(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
  }): Promise<number> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    return repository.count({
      where: {
        space: { id: args.spaceId },
        requestedBy: { id: args.requestedById },
        status: 'PENDING',
      },
    });
  }

  public async create(args: {
    spaceId: Space['id'];
    requestedById: User['id'];
    item: AddressBookItem;
  }): Promise<AddressBookRequest> {
    const repository = await this.db.getRepository(DbAddressBookRequest);
    // The owning space id is known up front, so ciphertext + blind index are
    // computed before insert — no two-phase dance.
    const encrypted =
      await this.spaceEncryptionService.encryptAddressBookRequest(
        args.spaceId,
        { address: args.item.address, name: args.item.name },
      );
    let result: InsertResult;
    try {
      result = await repository.insert({
        space: { id: args.spaceId },
        requestedBy: { id: args.requestedById },
        address: encrypted.address as DbAddressBookRequest['address'],
        addressIndex: encrypted.addressIndex,
        name: encrypted.name,
        chainIds: args.item.chainIds,
        status: 'PENDING',
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new UniqueConstraintError(
          'A pending request for this address already exists.',
        );
      }
      throw err;
    }
    const insertedId = result.identifiers[0].id;
    return this.findOneOrFail({ id: insertedId, spaceId: args.spaceId });
  }

  public async transitionFromPending(args: {
    id: AddressBookRequest['id'];
    spaceId: Space['id'];
    toStatus: 'APPROVED' | 'REJECTED';
    reviewedBy: User['id'];
    entityManager?: EntityManager;
  }): Promise<boolean> {
    const repository = args.entityManager
      ? args.entityManager.getRepository(DbAddressBookRequest)
      : await this.db.getRepository(DbAddressBookRequest);
    const result = await repository.update(
      { id: args.id, space: { id: args.spaceId }, status: 'PENDING' },
      { status: args.toStatus, reviewedBy: args.reviewedBy },
    );
    return (result.affected ?? 0) > 0;
  }
}
