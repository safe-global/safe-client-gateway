// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  And,
  type EntityManager,
  type FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { FieldEncryptionAad } from '@/datasources/encryption/field-encryption.constants';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import { SpaceAuditLog } from '@/modules/spaces/datasources/audit/entities/space-audit-log.entity.db';
import { Space as DbSpace } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import {
  applyAuditPayloadNames,
  collectAuditPayloadNames,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.encryption';
import {
  SpaceAuditEventSchema,
  SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import type {
  ISpaceAuditRepository,
  SpaceAuditFindArgs,
  SpaceAuditRecordArgs,
} from '@/modules/spaces/domain/audit/space-audit.repository.interface';

@Injectable()
export class SpaceAuditRepository implements ISpaceAuditRepository {
  private readonly isEnabled: boolean;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly fieldCrypto: PerEntityFieldCrypto,
  ) {
    this.isEnabled = this.configurationService.getOrThrow<boolean>(
      'features.spaceAuditLog',
    );
  }

  /**
   * Encrypts audit payload names under the owning space's data key, minting and
   * persisting the space key if absent. Returns values unchanged when disabled.
   */
  private async encryptAuditNames(
    entityManager: EntityManager,
    spaceId: number,
    names: Array<string>,
  ): Promise<Array<string>> {
    if (names.length === 0) {
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
      names.map((name) => ({
        value: name,
        aad: FieldEncryptionAad.SPACE_AUDIT_NAME,
      })),
    );
    if (encryptedDataKey !== null && encryptedDataKey !== existingKey) {
      await entityManager.update(DbSpace, spaceId, { encryptedDataKey });
    }
    return values;
  }

  /** Decrypts audit payload names under the space key (one unwrap per call). */
  private async decryptAuditNames(
    spaceId: number,
    names: Array<string>,
  ): Promise<Array<string>> {
    if (!names.some((name) => this.fieldCrypto.isEncrypted(name))) {
      return names;
    }
    const spaceRepository =
      await this.postgresDatabaseService.getRepository(DbSpace);
    const space = await spaceRepository.findOne({
      where: { id: spaceId },
      select: { id: true, encryptedDataKey: true },
    });
    return this.fieldCrypto.decryptFields(
      { spaceId: String(spaceId) },
      space?.encryptedDataKey ?? null,
      names.map((name) => ({
        value: name,
        aad: FieldEncryptionAad.SPACE_AUDIT_NAME,
      })),
    );
  }

  public async record(
    entityManager: EntityManager,
    args: SpaceAuditRecordArgs,
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Parsing strips unknown payload fields at the write boundary, validating
    // plaintext before it is encrypted for storage.
    const event = SpaceAuditEventSchema.parse({
      eventType: args.eventType,
      payload: args.payload,
    });

    const names = collectAuditPayloadNames(event.eventType, event.payload);
    const payload =
      names.length > 0
        ? applyAuditPayloadNames(
            event.eventType,
            event.payload,
            await this.encryptAuditNames(entityManager, args.spaceId, names),
          )
        : event.payload;

    await entityManager.insert(SpaceAuditLog, {
      spaceId: args.spaceId,
      spaceUuid: args.spaceUuid,
      eventType: event.eventType,
      actorUserId: args.actorUserId,
      payload,
    });
  }

  public async findBySpaceId(
    args: SpaceAuditFindArgs,
  ): Promise<[Array<SpaceAuditLog>, number]> {
    const repository =
      await this.postgresDatabaseService.getRepository(SpaceAuditLog);

    const createdAtBounds = [
      ...(args.createdAtGte ? [MoreThanOrEqual(args.createdAtGte)] : []),
      ...(args.createdAtLte ? [LessThanOrEqual(args.createdAtLte)] : []),
    ];
    const where: FindOptionsWhere<SpaceAuditLog> = {
      spaceId: args.spaceId,
      ...(args.eventTypes &&
        args.eventTypes.length > 0 && { eventType: In(args.eventTypes) }),
      ...(args.actorUserId !== undefined && {
        actorUserId: args.actorUserId,
      }),
      ...(createdAtBounds.length > 0 && { createdAt: And(...createdAtBounds) }),
    };

    // Same-transaction events share created_at — tie-break on id.
    const direction = args.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const [rows, count] = await repository.findAndCount({
      where,
      order: { createdAt: direction, id: direction },
      take: args.limit,
      skip: args.offset,
    });

    // Decrypt payload name fields before they leave the repository (and reach
    // DTO allowlisting). All rows belong to args.spaceId, so the space key is
    // resolved once; names are collected, decrypted as one batch, and mapped
    // back in the same traversal order.
    const perRowNames = rows.map((row) =>
      collectAuditPayloadNames(
        // Stored as the enum's string value (see entity column type).
        row.eventType as SpaceAuditEventType,
        row.payload,
      ),
    );
    const allNames = perRowNames.flat();
    if (allNames.length > 0) {
      const decrypted = await this.decryptAuditNames(args.spaceId, allNames);
      let cursor = 0;
      rows.forEach((row, index) => {
        const nameCount = perRowNames[index].length;
        if (nameCount > 0) {
          row.payload = applyAuditPayloadNames(
            row.eventType as SpaceAuditEventType,
            row.payload,
            decrypted.slice(cursor, cursor + nameCount),
          );
          cursor += nameCount;
        }
      });
    }

    return [rows, count];
  }

  public async findDistinctActorIds(spaceId: number): Promise<Array<number>> {
    const repository =
      await this.postgresDatabaseService.getRepository(SpaceAuditLog);

    const rows = await repository
      .createQueryBuilder('sal')
      .select('sal.actor_user_id', 'actorUserId')
      .distinct(true)
      .where('sal.space_id = :spaceId', { spaceId })
      .orderBy('sal.actor_user_id', 'ASC')
      .getRawMany<{ actorUserId: number }>();

    return rows.map((row) => row.actorUserId);
  }
}
