// SPDX-License-Identifier: FSL-1.1-MIT

import { Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager, FindOptionsWhere, InsertResult } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { AddressBookRequest as DbAddressBookRequest } from '@/modules/spaces/datasources/address-books/entities/address-book-request.entity.db';
import { Space as DbSpace } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookRequestsRepository } from '@/modules/spaces/domain/address-books/address-book-requests.repository.interface';
import type { AddressBookItem } from '@/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type {
  AddressBookRequest,
  AddressBookRequestStatus,
} from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

@Injectable()
export class AddressBookRequestsRepository
  implements IAddressBookRequestsRepository
{
  constructor(
    private readonly db: PostgresDatabaseService,
    private readonly fieldCrypto: PerEntityFieldCrypto,
  ) {}

  /**
   * Encrypts request names under the owning space's data key, minting and
   * persisting the space key if absent. Returns values unchanged when disabled.
   */
  private async encryptRequestNames(
    entityManager: EntityManager,
    spaceId: Space['id'],
    fields: Array<{ value: string; aad: string }>,
  ): Promise<Array<string>> {
    if (fields.length === 0) {
      return [];
    }
    const space = await entityManager.findOne(DbSpace, {
      where: { id: spaceId },
      select: { id: true, encryptedDataKey: true },
    });
    const existingKey = space?.encryptedDataKey ?? null;
    const { encryptedDataKey, values } = await this.fieldCrypto.encryptFields(
      { spaceId: String(spaceId) },
      existingKey,
      fields,
    );
    if (encryptedDataKey !== null && encryptedDataKey !== existingKey) {
      await entityManager.update(DbSpace, spaceId, { encryptedDataKey });
    }
    return values;
  }

  /** Decrypts loaded requests' `name` under the space key (one unwrap per call). */
  private async decryptRequests(
    spaceId: Space['id'],
    requests: Array<DbAddressBookRequest>,
  ): Promise<void> {
    const targets = requests.filter((request) =>
      this.fieldCrypto.isEncrypted(request.name),
    );
    if (targets.length === 0) {
      return;
    }
    const spaceRepository = await this.db.getRepository(DbSpace);
    const space = await spaceRepository.findOne({
      where: { id: spaceId },
      select: { id: true, encryptedDataKey: true },
    });
    const decrypted = await this.fieldCrypto.decryptFields(
      { spaceId: String(spaceId) },
      space?.encryptedDataKey ?? null,
      targets.map((request) => ({
        value: request.name,
        aad: FieldEncryptionAad.ADDRESS_BOOK_REQUEST_NAME,
      })),
    );
    decrypted.forEach((value, index) => {
      targets[index].name = value;
    });
  }

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
      relations: ['requestedBy'],
      order: { createdAt: 'DESC' },
    });
    await this.decryptRequests(args.spaceId, requests);
    return requests;
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
      relations: ['requestedBy'],
      order: { createdAt: 'DESC' },
    });
    await this.decryptRequests(args.spaceId, requests);
    return requests;
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
    await this.decryptRequests(args.spaceId, [request]);
    return request;
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
    // Encrypt the name and insert atomically: a space key minted here (for a
    // space created while encryption was disabled) must commit with the row.
    const insertedId = await this.db.transaction(async (entityManager) => {
      const [encryptedName] = await this.encryptRequestNames(
        entityManager,
        args.spaceId,
        [
          {
            value: args.item.name,
            aad: FieldEncryptionAad.ADDRESS_BOOK_REQUEST_NAME,
          },
        ],
      );
      let result: InsertResult;
      try {
        result = await entityManager.insert(DbAddressBookRequest, {
          space: { id: args.spaceId },
          requestedBy: { id: args.requestedById },
          address: args.item.address,
          name: encryptedName,
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
      return result.identifiers[0].id;
    });
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
