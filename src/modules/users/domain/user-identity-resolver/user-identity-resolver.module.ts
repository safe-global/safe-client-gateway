// SPDX-License-Identifier: FSL-1.1-MIT

import { forwardRef, Module } from '@nestjs/common';
import { UserIdentityResolverService } from '@/modules/users/domain/user-identity-resolver/user-identity-resolver.service';
import { UsersModule } from '@/modules/users/users.module';
import { WalletEncryptionModule } from '@/modules/wallets/domain/wallet-encryption.module';
import { WalletsModule } from '@/modules/wallets/wallets.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    WalletsModule,
    WalletEncryptionModule,
  ],
  providers: [UserIdentityResolverService],
  exports: [UserIdentityResolverService],
})
export class UserIdentityResolverModule {}
