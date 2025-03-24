import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { SpacesRepositoryModule } from '@/domain/spaces/spaces.repository.module';
import { MembersRepository } from '@/domain/users/members.repository';
import { IMembersRepository } from '@/domain/users/members.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { WalletsRepositoryModule } from '@/domain/wallets/wallets.repository.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Wallet, User, Member]),
    SpacesRepositoryModule,
    UserRepositoryModule,
    WalletsRepositoryModule,
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
