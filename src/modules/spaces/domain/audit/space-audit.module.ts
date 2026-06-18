// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { SpaceAuditLog } from '@/modules/spaces/datasources/entities/space-audit-log.entity.db';
import { SpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository';
import { ISpaceAuditRepository } from '@/modules/spaces/domain/audit/space-audit.repository.interface';

/**
 * Leaf module of the append-only space audit log, consumed by both
 * `SpacesModule` and `UsersModule`. Writes are gated by
 * `features.spaceAuditLog`.
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([SpaceAuditLog]),
  ],
  providers: [
    {
      provide: ISpaceAuditRepository,
      useClass: SpaceAuditRepository,
    },
  ],
  exports: [ISpaceAuditRepository],
})
export class SpaceAuditModule {}
