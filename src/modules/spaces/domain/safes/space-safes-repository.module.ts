// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '#/datasources/db/v2/postgres-database.module';
import { KmsEncryptionModule } from '#/datasources/kms/kms-encryption.module';
import { SpaceSafe } from '#/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '#/modules/spaces/datasources/spaces/entities/space.entity.db';
import { SpaceAuditModule } from '#/modules/spaces/domain/audit/space-audit.module';
import { SpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

/**
 * Standalone module for {@link ISpaceSafesRepository} so that the cache
 * invalidation of hook events can find the spaces holding a Safe without
 * importing {@link SpacesModule}, which registers its controllers and is only
 * loaded with `features.users` on. Mirrors the {@link UsersRepositoryModule}
 * pattern.
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Space, SpaceSafe]),
    SpaceAuditModule,
    KmsEncryptionModule,
  ],
  providers: [
    SpaceEncryptionService,
    { provide: ISpaceSafesRepository, useClass: SpaceSafesRepository },
  ],
  exports: [ISpaceSafesRepository],
})
export class SpaceSafesRepositoryModule {}
