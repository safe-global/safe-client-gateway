// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { getScopedRepository } from '@/datasources/db/v2/get-scoped-repository.util';
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
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      Feature,
      entityManager,
    );
    return await repository.find({ order: { id: 'ASC' } });
  }

  public async getFeatureByKey(
    key: FeatureKey,
    entityManager?: EntityManager,
  ): Promise<Feature | null> {
    const repository = await getScopedRepository(
      this.postgresDatabaseService,
      Feature,
      entityManager,
    );
    return await repository.findOne({ where: { key } });
  }
}
