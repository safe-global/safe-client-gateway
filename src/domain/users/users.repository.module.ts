import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UsersRepository } from '@/domain/users/users.repository';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { WalletsRepositoryModule } from '@/domain/wallets/wallets.repository.module';
import { Member } from '@/datasources/users/entities/member.entity.db';

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
