// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';

@Injectable()
export class FeaturesRepository implements IFeaturesRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getFeatures(
    entityManager?: EntityManager,
  ): Promise<Array<Feature>> {
    const repository = await this.getRepository(entityManager);
    return await repository.find({ order: { id: 'ASC' } });
  }

  public async getFeatureByKey(
    key: FeatureKey,
    entityManager?: EntityManager,
  ): Promise<Feature | null> {
    const repository = await this.getRepository(entityManager);
    return await repository.findOne({ where: { key } });
  }

  /** Bound to the caller's transaction when one is passed. */
  private async getRepository(
    entityManager?: EntityManager,
  ): Promise<Repository<Feature>> {
    return entityManager
      ? entityManager.getRepository(Feature)
      : await this.postgresDatabaseService.getRepository(Feature);
  }
}
