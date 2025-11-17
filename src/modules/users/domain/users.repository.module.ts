import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsRepositoryModule } from '@/modules/wallets/domain/wallets.repository.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([User, Wallet, Member]),
    WalletsRepositoryModule,
  ],
  providers: [
    {
      provide: IUsersRepository,
      useClass: UsersRepository,
    },
  ],
  exports: [IUsersRepository],
})
export class UserRepositoryModule {}
