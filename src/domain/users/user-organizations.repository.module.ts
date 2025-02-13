import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';
import { OrganizationsRepositoryModule } from '@/domain/organizations/organizations.repository.module';
import { UsersOrganizationsRepository } from '@/domain/users/user-organizations.repository';
import { IUsersOrganizationsRepository } from '@/domain/users/user-organizations.repository.interface';
import { UserRepositoryModule } from '@/domain/users/users.repository.module';
import { WalletsRepositoryModule } from '@/domain/wallets/wallets.repository.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([Wallet, User, UserOrganization]),
    OrganizationsRepositoryModule,
    UserRepositoryModule,
    WalletsRepositoryModule,
  ],
  providers: [
    {
      provide: IUsersOrganizationsRepository,
      useClass: UsersOrganizationsRepository,
    },
  ],
  exports: [IUsersOrganizationsRepository],
})
export class UsersOrganizationsRepositoryModule {}
