// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { SpaceSafeSubscriber } from '@/datasources/encryption/subscribers/space-safe.subscriber';
import { WalletSubscriber } from '@/datasources/encryption/subscribers/wallet.subscriber';

@Module({
  providers: [SpaceSafeSubscriber, WalletSubscriber],
})
export class EncryptionSubscribersModule {}
