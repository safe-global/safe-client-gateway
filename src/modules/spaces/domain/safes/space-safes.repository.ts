// SPDX-License-Identifier: FSL-1.1-MIT
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import {
  type EntityManager,
  type FindOptionsRelations,
  type FindOptionsSelect,
  type FindOptionsWhere,
  IsNull,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { isUniqueConstraintError } from '@/datasources/errors/helpers/is-unique-constraint-error.helper';
import { UniqueConstraintError } from '@/datasources/errors/unique-constraint-error';
import { IEntitlementsRepository } from '@/modules/entitlements/domain/entitlements.repository.interface';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';

export class SpaceSafesRepository implements ISpaceSafesRepository {
  private readonly maxSafesPerSpace: number;
  private readonly isEntitlementsEnabled: boolean;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpaceAuditRepository)
    private readonly spaceAuditRepository: ISpaceAuditRepository,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
    @Inject(IEntitlementsRepository)
    private readonly entitlementsRepository: IEntitlementsRepository,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {
    this.maxSafesPerSpace = this.configurationService.getOrThrow<number>(
      'spaces.maxSafesPerSpace',
    );
    this.isEntitlementsEnabled = this.configurationService.getOrThrow<boolean>(
      'features.billingService',
    );
  }

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

  public async create(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void> {
    if (!this.isEntitlementsEnabled) {
      // Static limit (pre-entitlements behavior, FF_BILLING_SERVICE off).
      // A count is enough for the limit check — findBySpaceId would decrypt
      // every existing row (one KMS call each) just to measure the length.
      const spaceSafeRepository =
        await this.postgresDatabaseService.getRepository(SpaceSafe);
      const existingCount = await spaceSafeRepository.count({
        where: { space: { id: args.spaceId } },
      });
      if (existingCount + args.payload.length > this.maxSafesPerSpace) {
        const remaining = this.maxSafesPerSpace - existingCount;
        throw new BadRequestException(
          remaining > 0
            ? `This Workspace only allows a maximum of ${this.maxSafesPerSpace} Safe Accounts. You can only add up to ${remaining} more.`
            : `This Workspace only allows a maximum of ${this.maxSafesPerSpace} Safe Accounts.`,
        );
      }
    }

    // The owning space id is known before every insert, so ciphertext and
    // blind index are computed up front — no two-phase dance like spaces.name.
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
      if (this.isEntitlementsEnabled) {
        // Plan-driven seat quota, counted live inside the insert transaction
        // so concurrent additions cannot slip past the limit. Throws a typed
        // 402 QUOTA_EXCEEDED.
        await this.entitlementsRepository.checkQuotaOrFail({
          spaceId: args.spaceId,
          featureKey: 'safe_seats',
          increment: args.payload.length,
          entityManager,
        });
      }
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

    await this.invalidateEntitlementsCache(args.spaceId);
  }

  /**
   * Safe additions/removals change the `safe_seats` usage (and potentially
   * the over-seat set) served by GET /entitlements.
   */
  private async invalidateEntitlementsCache(
    spaceId: Space['id'],
  ): Promise<void> {
    if (!this.isEntitlementsEnabled) {
      return;
    }
    await this.cacheService.deleteByKey(
      CacheRouter.getSpaceEntitlementsCacheKey(spaceId),
    );
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

    await this.invalidateEntitlementsCache(args.spaceId);
  }

  public async resolveIds(args: {
    spaceId: Space['id'];
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<
    Array<{
      id: SpaceSafe['id'];
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>
  > {
    if (args.payload.length === 0) {
      return [];
    }

    // Same lookup construction as delete(): blind index for encrypted rows,
    // plaintext match otherwise.
    const where: Array<FindOptionsWhere<SpaceSafe>> = args.payload.map(
      (safe) => {
        const addressIndex = this.spaceEncryptionService.safeAddressIndex(
          safe.address,
        );
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
      },
    );

    const spaceSafeRepository =
      await this.postgresDatabaseService.getRepository(SpaceSafe);
    const rows = await spaceSafeRepository.find({ where });

    // Match rows back to the caller's plaintext inputs (no decryption needed).
    return args.payload.flatMap((safe) => {
      const addressIndex = this.spaceEncryptionService.safeAddressIndex(
        safe.address,
      );
      const row = rows.find(
        (candidate) =>
          candidate.chainId === safe.chainId &&
          (addressIndex === null
            ? candidate.address === safe.address
            : candidate.addressIndex === addressIndex),
      );
      return row
        ? [{ id: row.id, chainId: safe.chainId, address: safe.address }]
        : [];
    });
  }
}
