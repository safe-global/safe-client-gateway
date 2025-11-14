import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { SpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { SpacesRepository } from '@/modules/spaces/domain/spaces.repository';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Space, SpaceSafe, Member]),
  ],
  providers: [
    {
      provide: ISpacesRepository,
      useClass: SpacesRepository,
    },
    {
      provide: ISpaceSafesRepository,
      useClass: SpaceSafesRepository,
    },
  ],
  exports: [ISpacesRepository, ISpaceSafesRepository],
})
export class SpacesRepositoryModule {}
