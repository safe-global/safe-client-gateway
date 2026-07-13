// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { KmsEncryptionModule } from '@/datasources/kms/kms-encryption.module';
import { SpaceAuditModule } from '@/modules/spaces/domain/audit/space-audit.module';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { User } from '@/modules/users/datasources/entities/users.entity.db';
import { UserEncryptionService } from '@/modules/users/domain/user-encryption.service';
import { UsersRepository } from '@/modules/users/domain/users.repository';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { WalletsModule } from '@/modules/wallets/wallets.module';

/**
 * Standalone module for {@link IUsersRepository} so that {@link OidcAuthModule}
 * can consume it without importing the full {@link UsersModule} (which also
 * registers {@link UsersController} and forward-imports {@link AuthModule} and
 * {@link SpacesModule}). Mirrors the {@link AuthRepositoryModule} pattern.
 *
 * {@link IMembersRepository} is intentionally NOT provided here: its
 * implementation depends on `ISpacesRepository`, which would re-introduce the
 * `SpacesModule` coupling this extraction is meant to remove. It remains in
 * {@link UsersModule}.
 */
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([User, Member, Wallet]),
    WalletsModule,
    SpaceAuditModule,
    KmsEncryptionModule,
  ],
  providers: [
    UserEncryptionService,
    { provide: IUsersRepository, useClass: UsersRepository },
  ],
  // UserEncryptionService is exported for MembersRepository (UsersModule),
  // which must decrypt the emails of relation-loaded users.
  exports: [IUsersRepository, UserEncryptionService],
})
export class UsersRepositoryModule {}
