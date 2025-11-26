import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { UsersController } from '@/modules/users/routes/users.controller';
import { UsersService } from '@/modules/users/routes/users.service';
import { AuthModule } from '@/modules/auth/auth.module';
import { WalletsModule } from '@/modules/wallets/wallets.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { SpacesRepositoryModule } from '@/modules/spaces/domain/spaces.repository.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([User, Member, Wallet]),
    WalletsModule,
    AuthModule,
    SiweModule,
    SpacesRepositoryModule,
  ],
  providers: [
    {
      provide: IUsersRepository,
      useClass: UsersRepository,
    },
    {
      provide: IMembersRepository,
      useClass: MembersRepository,
    },
    UsersService,
  ],
  controllers: [UsersController],
  exports: [IUsersRepository, IMembersRepository],
})
export class UsersModule {}
