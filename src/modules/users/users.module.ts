// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { SiweModule } from '@/modules/siwe/siwe.module';
import { SpaceAuditModule } from '@/modules/spaces/domain/audit/space-audit.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { MembersRepository } from '@/modules/users/domain/members/members.repository';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { UsersRepositoryModule } from '@/modules/users/domain/users-repository.module';
import { UsersController } from '@/modules/users/routes/users.controller';
import { UsersService } from '@/modules/users/routes/users.service';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletEncryptionModule } from '@/modules/wallets/domain/wallet-encryption.module';

@Module({
  imports: [
    UsersRepositoryModule,
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([User, Member, Wallet]),
    forwardRef(() => AuthModule),
    SiweModule,
    forwardRef(() => SpacesModule),
    WalletEncryptionModule,
    SpaceAuditModule,
  ],
  providers: [
    {
      provide: IMembersRepository,
      useClass: MembersRepository,
    },
    UsersService,
  ],
  controllers: [UsersController],
  exports: [UsersRepositoryModule, IMembersRepository],
})
export class UsersModule {}
