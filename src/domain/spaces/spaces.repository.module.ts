import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { Space } from '@/datasources/spaces/entities/space.entity.db';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { SpaceSafesRepository } from '@/domain/spaces/space-safes.repository';
import { ISpaceSafesRepository } from '@/domain/spaces/space-safes.repository.interface';
import { SpacesRepository } from '@/domain/spaces/spaces.repository';
import { ISpacesRepository } from '@/domain/spaces/spaces.repository.interface';
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
