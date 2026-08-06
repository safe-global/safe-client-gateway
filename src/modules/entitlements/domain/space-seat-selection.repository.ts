// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SpaceSeatSelection } from '@/modules/entitlements/datasources/entities/space-seat-selection.entity.db';
import type { ISpaceSeatSelectionRepository } from '@/modules/entitlements/domain/space-seat-selection.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

@Injectable()
export class SpaceSeatSelectionRepository
  implements ISpaceSeatSelectionRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getSelectedSpaceSafeIds(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<Array<number>> {
    const repository = await this.getRepository(entityManager);
    const selections = await repository.find({
      where: { space: { id: spaceId } },
      // Only the FK is needed; hydrating the Safe would also decrypt its
      // address for nothing.
      loadRelationIds: { relations: ['spaceSafe'] },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return selections.flatMap((selection) =>
      // With `loadRelationIds` the relation holds the raw id.
      selection.spaceSafe ? [selection.spaceSafe as unknown as number] : [],
    );
  }

  public async deleteSelectionBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = await this.getRepository(entityManager);
    await repository.delete({ space: { id: spaceId } });
  }

  public async createSelection(
    args: { spaceId: Space['id']; spaceSafeIds: Array<number> },
    entityManager?: EntityManager,
  ): Promise<void> {
    if (args.spaceSafeIds.length === 0) {
      return;
    }
    const repository = await this.getRepository(entityManager);
    await repository.insert(
      args.spaceSafeIds.map((spaceSafeId) => ({
        space: { id: args.spaceId },
        spaceSafe: { id: spaceSafeId },
      })),
    );
  }

  /** Bound to the caller's transaction when one is passed. */
  private async getRepository(
    entityManager?: EntityManager,
  ): Promise<Repository<SpaceSeatSelection>> {
    return entityManager
      ? entityManager.getRepository(SpaceSeatSelection)
      : await this.postgresDatabaseService.getRepository(SpaceSeatSelection);
  }
}
