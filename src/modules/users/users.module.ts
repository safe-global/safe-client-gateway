// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { UsersController } from '@/modules/users/routes/users.controller';
import { UsersService } from '@/modules/users/routes/users.service';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsModule } from '@/modules/wallets/wallets.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([User, Member, Wallet]),
    WalletsModule,
    forwardRef(() => AuthModule),
    SiweModule,
    forwardRef(() => SpacesModule),
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
