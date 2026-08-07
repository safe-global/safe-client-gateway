// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import type { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';

@Injectable()
export class FeaturesRepository implements IFeaturesRepository {
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getFeatures(): Promise<Array<Feature>> {
    const repository =
      await this.postgresDatabaseService.getRepository(Feature);
    return await repository.find({ order: { id: 'ASC' } });
  }
}
