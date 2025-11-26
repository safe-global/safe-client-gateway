import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { SpacesRepositoryModule } from '@/modules/spaces/domain/spaces.repository.module';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { UserRepositoryModule } from '@/modules/users/domain/users.repository.module';
import { WalletsModule } from '@/modules/wallets/wallets.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Wallet, User, Member]),
    SpacesRepositoryModule,
    UserRepositoryModule,
    WalletsModule,
  ],
  providers: [
    {
      provide: IMembersRepository,
      useClass: MembersRepository,
    },
  ],
  exports: [IMembersRepository],
})
export class MembersRepositoryModule {}
