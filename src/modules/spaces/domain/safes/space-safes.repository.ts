// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, NotFoundException } from '@nestjs/common';
import {
  type EntityManager,
  type FindOptionsRelations,
  type FindOptionsSelect,
  type FindOptionsWhere,
  IsNull,
} from 'typeorm';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';

/** Own namespace: the single-int lock key space is shared process-wide. */
const SEAT_LOCK_NAMESPACE = 1827;

export class SpaceSafesRepository implements ISpaceSafesRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {}

  private async findSpaceForAuditOrFail(
    entityManager: EntityManager,
    spaceId: Space['id'],
  ): Promise<Pick<Space, 'id' | 'uuid'>> {
    const space = await entityManager.findOne(Space, {
      where: { id: spaceId },
      select: { id: true, uuid: true },
    });
    if (!space) {
      throw new NotFoundException('Workspace not found.');
    }
    return space;
  }

  /** Serializes seat changes for a space until this transaction ends. */
  private async lockSeats(
    spaceId: Space['id'],
    entityManager: EntityManager,
  ): Promise<void> {
    await entityManager.query('SELECT pg_advisory_xact_lock($1, $2)', [
      SEAT_LOCK_NAMESPACE,
      spaceId,
    ]);
  }

  public async create(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
    assertSeats: (used: number) => void;
  }): Promise<void> {
    // Before the transaction on purpose: this keeps the KMS round-trips out of
    // it and out of the seat lock, leaving that critical section DB-local.
    // The space id is known up front, so no two-phase dance like spaces.name.
    const safesToInsert = await Promise.all(
      args.payload.map(async (safe) => ({
        space: { id: args.spaceId },
        chainId: safe.chainId,
        address: (await this.spaceEncryptionService.encryptSafeAddress(
          args.spaceId,
          safe.address,
        )) as SpaceSafe['address'],
        addressIndex: this.spaceEncryptionService.safeAddressIndex(
          safe.address,
        ),
      })),
    );

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await this.lockSeats(args.spaceId, entityManager);
      // Counted under the lock, so concurrent additions cannot each pass a
      // stale count.
      args.assertSeats(await this.countBySpaceId(args.spaceId, entityManager));

      try {
        // Catch-on-conflict as before; duplicates now collide on the partial
        // unique indexes (blind index for encrypted rows, plaintext for
        // plaintext rows when encryption is disabled).
        await entityManager.insert(SpaceSafe, safesToInsert);
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new UniqueConstraintError(
            `A SpaceSafe with the same chainId and address already exists: ${err.driverError.detail}`,
          );
        }
        throw err;
      }

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SAFE_ADDED,
        actorUserId: args.actorUserId,
        payload: {
          safes: args.payload.map((safe) => ({
            chainId: safe.chainId,
            address: safe.address,
          })),
        },
      });
    });
  }

  public async findBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<Pick<SpaceSafe, 'chainId' | 'address'>>> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    const spaceSafes = await spaceSafeRepository.find({
      select: { chainId: true, address: true },
      where: { space: { id: spaceId } },
    });
    // Repository boundary: callers receive plaintext addresses.
    return await this.spaceEncryptionService.decryptSpaceSafes(
      spaceId,
      spaceSafes,
    );
  }

  public async findOrFail(
    args: Parameters<SpaceSafesRepository['find']>[0],
  ): Promise<Array<SpaceSafe>> {
    const spaceSafes = await this.find(args);

    if (spaceSafes.length === 0) {
      throw new NotFoundException('Workspace has no Safes.');
    }

    return spaceSafes;
  }

  public async countBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<number> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      SpaceSafe,
      entityManager,
    );
    return await repository.count({ where: { space: { id: spaceId } } });
  }

  public async find(args: {
    where: Array<FindOptionsWhere<SpaceSafe>> | FindOptionsWhere<SpaceSafe>;
    select?: FindOptionsSelect<SpaceSafe>;
    relations?: FindOptionsRelations<SpaceSafe>;
  }): Promise<Array<SpaceSafe>> {
    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);

    const spaceSafes = await spaceSafeRepository.find(args);
    return await this.decryptLoadedSpaceSafes(spaceSafes);
  }

  /**
   * Repository boundary for the generic finders: decrypts `address` on
   * loaded rows. The space-scoped context comes from the loaded `space`
   * relation, so callers reading encrypted addresses must include it
   * ({@link findBySpaceId} passes the id explicitly instead). Plaintext rows
   * (encryption disabled) pass through untouched.
   */
  private async decryptLoadedSpaceSafes(
    spaceSafes: Array<SpaceSafe>,
  ): Promise<Array<SpaceSafe>> {
    return await Promise.all(
      spaceSafes.map(async (spaceSafe) => {
        if (!this.spaceEncryptionService.isEncrypted(spaceSafe.address)) {
          return spaceSafe;
        }
        if (spaceSafe.space === undefined) {
          throw new Error(
            'Cannot decrypt a SpaceSafe address without its space relation loaded',
          );
        }
        const [decrypted] = await this.spaceEncryptionService.decryptSpaceSafes(
          spaceSafe.space.id,
          [spaceSafe],
        );
        return decrypted;
      }),
    );
  }

  public async delete(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    const findSpaceSafesWhereClause: Array<FindOptionsWhere<SpaceSafe>> =
      args.payload.map((safe) => {
        const addressIndex = this.spaceEncryptionService.safeAddressIndex(
          safe.address,
        );
        // Encryption disabled: match plaintext with a NULL index. Otherwise
        // match on the blind index.
        return addressIndex === null
          ? {
              space: { id: args.spaceId },
              chainId: safe.chainId,
              addressIndex: IsNull(),
              address: safe.address,
            }
          : {
              space: { id: args.spaceId },
              chainId: safe.chainId,
              addressIndex,
            };
      });

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const spaceSafes = await entityManager.find(SpaceSafe, {
        where: findSpaceSafesWhereClause,
      });
      if (spaceSafes.length === 0) {
        throw new NotFoundException('Workspace has no Safes.');
      }

      await entityManager.remove(spaceSafes);

      const space = await this.findSpaceForAuditOrFail(
        entityManager,
        args.spaceId,
      );

      const decryptedSafes =
        await this.spaceEncryptionService.decryptSpaceSafes(
          args.spaceId,
          spaceSafes,
        );
      await this.spaceAuditRepository.record(entityManager, {
        spaceId: space.id,
        spaceUuid: space.uuid,
        eventType: SpaceAuditEventType.SAFE_REMOVED,
        actorUserId: args.actorUserId,
        payload: {
          safes: decryptedSafes.map((safe) => ({
            chainId: safe.chainId,
            address: safe.address,
          })),
        },
      });
    });
  }
}
