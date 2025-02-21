import { Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '@/datasources/organizations/entities/organizations.entity.db';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { OrganizationsRepository } from '@/domain/organizations/organizations.repository';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { IOrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository.interface';
import { OrganizationSafesRepository } from '@/domain/organizations/organizations-safe.repository';
import { OrganizationSafe } from '@/datasources/organizations/entities/organization-safes.entity.db';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([
      Organization,
      OrganizationSafe,
      UserOrganization,
    ]),
  ],
  providers: [
    {
      provide: IOrganizationsRepository,
      useClass: OrganizationsRepository,
    },
    {
      provide: IOrganizationSafesRepository,
      useClass: OrganizationSafesRepository,
    },
  ],
  exports: [IOrganizationsRepository, IOrganizationSafesRepository],
})
export class OrganizationsRepositoryModule {}
