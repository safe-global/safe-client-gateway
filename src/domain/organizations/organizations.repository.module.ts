import { Module } from '@nestjs/common';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organizations } from '@/datasources/organizations/entities/organizations.entity.db';
import { IOrganizationsRepository } from '@/domain/organizations/organizations.repository.interface';
import { OrganizationsRepository } from '@/domain/organizations/organizations.repository';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Organizations]),
  ],
  providers: [
    {
      provide: IOrganizationsRepository,
      useClass: OrganizationsRepository,
    },
  ],
  exports: [IOrganizationsRepository],
})
export class OrganizationsRepositoryModule {}
