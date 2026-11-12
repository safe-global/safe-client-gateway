// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import { SpaceSetup as DbSpaceSetup } from '#/modules/spaces/datasources/setup/entities/space-setup.entity.db';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import {
  type SpaceSetup,
  type SpaceSetupPayload,
  SpaceSetupPayloadSchema,
  type SpaceSetupStatus,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { isClaimable } from '#/modules/spaces/domain/setup/space-setup-claim.rules';
import type { ISpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

@Injectable()
export class SpaceSetupsRepository implements ISpaceSetupsRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
  ) {}

  public async createPending(args: {
    spaceId: Space['id'];
    paymentLinkId: string | null;
    payload: SpaceSetupPayload;
    entityManager: EntityManager;
  }): Promise<void> {
    await args.entityManager.insert(DbSpaceSetup, {
      spaceId: args.spaceId,
      paymentLinkId: args.paymentLinkId,
      payload: await this.spaceEncryptionService.encryptSetupPayload(
        args.spaceId,
        args.payload,
      ),
      status: 'PENDING',
      appliedAt: null,
    });
  }

  public async findBySpaceId(spaceId: Space['id']): Promise<SpaceSetup | null> {
    const repository =
      await this.postgresDatabaseService.getRepository(DbSpaceSetup);
    const row = await repository.findOne({ where: { spaceId } });
    return row ? await this.decrypt(row) : null;
  }

  public async findStateBySpaceId(
    spaceId: Space['id'],
  ): Promise<Pick<SpaceSetup, 'status' | 'paymentLinkId'> | null> {
    const repository =
      await this.postgresDatabaseService.getRepository(DbSpaceSetup);
    return await repository.findOne({
      select: { status: true, paymentLinkId: true },
      where: { spaceId },
    });
  }

  public async findBySpaceIdForUpdate(
    spaceId: Space['id'],
    entityManager: EntityManager,
  ): Promise<SpaceSetup | null> {
    const row = await entityManager.findOne(DbSpaceSetup, {
      where: { spaceId },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? await this.decrypt(row) : null;
  }

  public async findStatusesBySpaceIds(
    spaceIds: Array<Space['id']>,
  ): Promise<Map<Space['id'], keyof typeof SpaceSetupStatus>> {
    if (spaceIds.length === 0) {
      return new Map();
    }
    const repository =
      await this.postgresDatabaseService.getRepository(DbSpaceSetup);
    const rows = await repository.find({
      select: { spaceId: true, status: true },
      where: { spaceId: In(spaceIds) },
    });
    return new Map(rows.map((row) => [row.spaceId, row.status]));
  }

  public async replace(args: {
    spaceId: Space['id'];
    paymentLinkId: string | null;
    payload: SpaceSetupPayload;
    entityManager: EntityManager;
  }): Promise<void> {
    await args.entityManager.update(
      DbSpaceSetup,
      { spaceId: args.spaceId },
      {
        paymentLinkId: args.paymentLinkId,
        payload: await this.spaceEncryptionService.encryptSetupPayload(
          args.spaceId,
          args.payload,
        ),
      },
    );
  }

  public async claim(args: {
    spaceId: Space['id'];
    leaseSeconds: number;
  }): Promise<SpaceSetup | null> {
    const claimed = await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        const row = await entityManager.findOne(DbSpaceSetup, {
          where: { spaceId: args.spaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !(
            row &&
            isClaimable(row, {
              now: new Date(),
              leaseSeconds: args.leaseSeconds,
            })
          )
        ) {
          return null;
        }
        await entityManager.update(
          DbSpaceSetup,
          { spaceId: args.spaceId },
          { status: 'APPLYING' },
        );
        return row;
      },
    );
    // Decrypted after the commit, so no KMS call holds the row lock.
    return claimed ? await this.decrypt(claimed) : null;
  }

  public async markApplied(spaceId: Space['id']): Promise<void> {
    const repository =
      await this.postgresDatabaseService.getRepository(DbSpaceSetup);
    await repository.update(
      { spaceId, status: 'APPLYING' },
      { status: 'APPLIED', appliedAt: () => 'CURRENT_TIMESTAMP' },
    );
  }

  private async decrypt(row: DbSpaceSetup): Promise<SpaceSetup> {
    const payload = await this.spaceEncryptionService.decryptSetupPayload(
      row.spaceId,
      row.payload,
    );
    return { ...row, payload: SpaceSetupPayloadSchema.parse(payload) };
  }
}
